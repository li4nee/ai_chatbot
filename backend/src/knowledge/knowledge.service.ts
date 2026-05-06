import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Knowledge } from './entities/knowledge.entity';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/create-knowledge.dto';
import { PDFParse } from 'pdf-parse';
import { AiService } from '../ai/ai.service';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(Knowledge)
    private knowledgeRepo: Repository<Knowledge>,
    private aiService: AiService,
  ) {}

  async create(botId: string, dto: CreateKnowledgeDto): Promise<Knowledge> {
    const embedding = await this.aiService.generateEmbedding(dto.content);
    const knowledge = this.knowledgeRepo.create({
      botId,
      content: dto.content,
      embedding: embedding.length > 0 ? embedding : undefined,
    });
    const saved = await this.knowledgeRepo.save(knowledge);
    this.logger.log(`Knowledge added to bot ${botId}: ${saved.id}`);
    return saved;
  }

  /** Paginated knowledge list for a bot */
  async findAllByBot(
    botId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Knowledge[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.knowledgeRepo.findAndCount({
      where: { botId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  /** Update a knowledge chunk's content */
  async update(id: string, dto: UpdateKnowledgeDto): Promise<Knowledge> {
    const knowledge = await this.knowledgeRepo.findOne({ where: { id } });
    if (!knowledge) {
      throw new NotFoundException('Knowledge chunk not found');
    }
    knowledge.content = dto.content;
    const updated = await this.knowledgeRepo.save(knowledge);
    this.logger.log(`Knowledge updated: ${id}`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const knowledge = await this.knowledgeRepo.findOne({ where: { id } });
    if (!knowledge) {
      throw new NotFoundException('Knowledge chunk not found');
    }
    await this.knowledgeRepo.remove(knowledge);
    this.logger.log(`Knowledge deleted: ${id}`);
  }

  async removeAllByBot(botId: string): Promise<void> {
    await this.knowledgeRepo.delete({ botId });
    this.logger.log(`All knowledge deleted for bot: ${botId}`);
  }

  /**
   * Delete with ownership verification — ensures the knowledge
   * belongs to a bot owned by the requesting user.
   */
  async removeWithOwnerCheck(id: string, userId: string): Promise<void> {
    const knowledge = await this.knowledgeRepo.findOne({
      where: { id },
      relations: ['bot'],
    });
    if (!knowledge) {
      throw new NotFoundException('Knowledge chunk not found');
    }
    if (knowledge.bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    await this.knowledgeRepo.remove(knowledge);
    this.logger.log(`Knowledge deleted (with owner check): ${id} by user ${userId}`);
  }

  /**
   * Update with ownership verification.
   */
  async updateWithOwnerCheck(id: string, userId: string, dto: UpdateKnowledgeDto): Promise<Knowledge> {
    const knowledge = await this.knowledgeRepo.findOne({
      where: { id },
      relations: ['bot'],
    });
    if (!knowledge) {
      throw new NotFoundException('Knowledge chunk not found');
    }
    if (knowledge.bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    knowledge.content = dto.content;
    const updated = await this.knowledgeRepo.save(knowledge);
    this.logger.log(`Knowledge updated (with owner check): ${id} by user ${userId}`);
    return updated;
  }

  /**
   * Fetch relevant knowledge context for a bot.
   * If a userMessage is provided, uses Vector Similarity Search (RAG).
   * Otherwise, fetches the most recent chunks.
   */
  async getContextForBot(botId: string, userMessage?: string): Promise<string> {
    if (!userMessage) {
      const chunks = await this.knowledgeRepo.find({
        where: { botId },
        select: ['content'],
        order: { createdAt: 'DESC' },
        take: 5,
      });
      return chunks.map((c) => c.content).join('\n\n');
    }

    try {
      const userEmbedding = await this.aiService.generateEmbedding(userMessage);
      
      // If embedding fails (e.g. 404 or empty), fall back to recent chunks
      if (userEmbedding.length === 0) {
        this.logger.warn('Embedding failed, falling back to recent chunks');
        const chunks = await this.knowledgeRepo.find({
          where: { botId },
          select: ['content'],
          order: { createdAt: 'DESC' },
          take: 5,
        });
        return chunks.map((c) => c.content).join('\n\n');
      }

      const allChunks = await this.knowledgeRepo.find({
        where: { botId },
      });

      const relevantChunks = allChunks
        .filter((c) => c.embedding && c.embedding.length > 0)
        .map((c) => ({
          content: c.content,
          score: this.cosineSimilarity(userEmbedding, c.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Take top 5 most relevant chunks

      if (relevantChunks.length === 0) {
        // Fallback to recent if no embeddings found
        return '';
      }

      return relevantChunks.map((c) => c.content).join('\n\n');
    } catch (err) {
      this.logger.error(`Similarity search failed: ${err.message}`);
      return '';
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
  }

  /**
   * Process a PDF buffer, extract text, and save in chunks.
   */
  async addKnowledgeFromPdf(botId: string, buffer: Buffer): Promise<void> {
    try {
      this.logger.log('Starting PDF extraction...');
      
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text;
      
      if (!text) {
        this.logger.warn('PDF extraction returned no text');
        return;
      }
      
      // Clean up text
      const cleanText = text.replace(/\s+/g, ' ').trim();
      
      // Split into ~2000 character chunks
      const chunks = this.chunkText(cleanText, 2000);
      
      for (const content of chunks) {
        if (content.length > 10) { // skip tiny fragments
          await this.create(botId, { content });
        }
      }
      this.logger.log(`Processed PDF for bot ${botId}: ${chunks.length} chunks created`);
    } catch (err) {
      this.logger.error(`PDF Processing error: ${err.message}`, err.stack);
      throw new Error(`Failed to process PDF file: ${err.message}`);
    }
  }

  private chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      // Try to find a good breaking point (period or newline) near the size
      let end = i + size;
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('. ', end);
        if (lastPeriod > i + size * 0.8) {
          end = lastPeriod + 1;
        }
      }
      chunks.push(text.substring(i, end).trim());
      i = end;
    }
    return chunks;
  }
}
