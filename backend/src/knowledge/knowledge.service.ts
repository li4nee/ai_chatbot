import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Knowledge } from './entities/knowledge.entity';
import {
  CreateKnowledgeDto,
  UpdateKnowledgeDto,
} from './dto/create-knowledge.dto';
import { PDFParse } from 'pdf-parse';
import { AiService } from '../ai/ai.service';
import { BotService } from '../bot/bot.service';
import { AiProvider } from '../ai/ai-provider.enum';
import {
  chunkText,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
} from './chunker.util';

/** Chunks below this cosine similarity to the query are considered noise, not context. */
const MIN_RELEVANCE_SCORE = 0.68;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(Knowledge)
    private knowledgeRepo: Repository<Knowledge>,
    private aiService: AiService,
    private botService: BotService,
  ) {}

  /** Creates one row per chunk — content over the chunk size threshold is split with overlap. */
  async create(botId: string, dto: CreateKnowledgeDto): Promise<Knowledge[]> {
    const { provider, apiKey } = await this.botService.getEmbeddingCredentials(botId);
    const pieces =
      dto.content.length > DEFAULT_CHUNK_SIZE
        ? chunkText(dto.content, {
            size: DEFAULT_CHUNK_SIZE,
            overlap: DEFAULT_CHUNK_OVERLAP,
          })
        : [dto.content.trim()];

    return this.saveChunks(botId, provider, apiKey, pieces);
  }

  private async saveChunks(
    botId: string,
    provider: AiProvider,
    apiKey: string,
    pieces: string[],
  ): Promise<Knowledge[]> {
    const saved: Knowledge[] = [];
    for (const content of pieces) {
      const embedding = await this.aiService.generateEmbedding(provider, apiKey, content);
      const knowledge = this.knowledgeRepo.create({
        botId,
        content,
        embedding: embedding.length > 0 ? embedding : undefined,
      });
      saved.push(await this.knowledgeRepo.save(knowledge));
    }
    this.logger.log(
      `Knowledge added to bot ${botId}: ${saved.length} chunk(s)`,
    );
    return saved;
  }

  /** Paginated knowledge list for a bot */
  async findAllByBot(
    botId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: Knowledge[];
    total: number;
    page: number;
    limit: number;
  }> {
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
    this.logger.log(
      `Knowledge deleted (with owner check): ${id} by user ${userId}`,
    );
  }

  /**
   * Update with ownership verification.
   */
  async updateWithOwnerCheck(
    id: string,
    userId: string,
    dto: UpdateKnowledgeDto,
  ): Promise<Knowledge> {
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
    this.logger.log(
      `Knowledge updated (with owner check): ${id} by user ${userId}`,
    );
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

    const { provider, apiKey } = await this.botService.getEmbeddingCredentials(botId);
    try {
      const userEmbedding = await this.aiService.generateEmbedding(provider, apiKey, userMessage);

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
        .filter((c) => c.score >= MIN_RELEVANCE_SCORE) // drop weakly-related chunks rather than forcing them into the prompt
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Take top 5 most relevant chunks

      if (relevantChunks.length === 0) {
        // Nothing cleared the relevance floor — let the caller fall back to the "no answer" response
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

      // Collapse runs of horizontal whitespace but keep paragraph breaks — the
      // chunker uses blank lines to find good split points.
      const cleanText = text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const chunks = chunkText(cleanText, {
        size: DEFAULT_CHUNK_SIZE,
        overlap: DEFAULT_CHUNK_OVERLAP,
      });

      const { provider, apiKey } = await this.botService.getEmbeddingCredentials(botId);
      await this.saveChunks(botId, provider, apiKey, chunks);
      this.logger.log(
        `Processed PDF for bot ${botId}: ${chunks.length} chunks created`,
      );
    } catch (err) {
      this.logger.error(`PDF Processing error: ${err.message}`, err.stack);
      throw new Error(`Failed to process PDF file: ${err.message}`);
    }
  }
}
