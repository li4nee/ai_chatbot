import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Knowledge } from './entities/knowledge.entity';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/create-knowledge.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @InjectRepository(Knowledge)
    private knowledgeRepo: Repository<Knowledge>,
  ) {}

  async create(botId: string, dto: CreateKnowledgeDto): Promise<Knowledge> {
    const knowledge = this.knowledgeRepo.create({
      botId,
      content: dto.content,
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
   * Fetch all knowledge text for a bot, concatenated.
   * Used by the AI service for RAG context injection.
   * Limited to ~8000 chars to prevent token overflow.
   */
  async getContextForBot(botId: string): Promise<string> {
    const chunks = await this.knowledgeRepo.find({
      where: { botId },
      select: ['content'],
    });
    const full = chunks.map((c) => c.content).join('\n\n');
    const MAX_CONTEXT_LENGTH = 8000;
    return full.length > MAX_CONTEXT_LENGTH
      ? full.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context truncated...]'
      : full;
  }
}
