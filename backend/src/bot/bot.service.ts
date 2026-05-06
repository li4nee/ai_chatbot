import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Bot } from './entities/bot.entity';
import { CreateBotDto, UpdateBotDto } from './dto/create-bot.dto';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectRepository(Bot)
    private botRepo: Repository<Bot>,
  ) {}

  async create(userId: string, dto: CreateBotDto): Promise<Bot> {
    const bot = this.botRepo.create({
      ...dto,
      userId,
      apiKey: `bot_${uuidv4().replace(/-/g, '')}`,
    });
    const saved = await this.botRepo.save(bot);
    this.logger.log(`Bot created: ${saved.id} by user ${userId}`);
    return saved;
  }

  /** Paginated bot list for a user */
  async findAllByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Bot[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.botRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<Bot> {
    const bot = await this.botRepo.findOne({ where: { id } });
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    if (bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return bot;
  }

  /** Update bot settings */
  async update(id: string, userId: string, dto: UpdateBotDto): Promise<Bot> {
    const bot = await this.findOne(id, userId);
    
    // Assign all provided fields in dto to the bot entity
    Object.assign(bot, dto);
    
    const updated = await this.botRepo.save(bot);
    this.logger.log(`Bot updated: ${id}`);
    return updated;
  }

  /** Regenerate API key for a bot */
  async rotateApiKey(id: string, userId: string): Promise<Bot> {
    const bot = await this.findOne(id, userId);
    bot.apiKey = `bot_${uuidv4().replace(/-/g, '')}`;
    const updated = await this.botRepo.save(bot);
    this.logger.warn(`API key rotated for bot: ${id} by user ${userId}`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const bot = await this.findOne(id, userId);
    await this.botRepo.remove(bot);
    this.logger.log(`Bot deleted: ${id} by user ${userId}`);
  }
}
