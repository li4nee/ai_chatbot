import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usage } from './entities/usage.entity';
import { Conversation } from '../chat/entities/conversation.entity';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectRepository(Usage)
    private usageRepo: Repository<Usage>,
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
  ) {}

  /**
   * Increment usage for a bot in the current month.
   */
  async incrementUsage(botId: string, tokens: number = 0): Promise<void> {
    const month = new Date().toISOString().substring(0, 7); // "YYYY-MM"

    try {
      // Upsert logic: attempt to increment, create if not exists
      const usage = await this.usageRepo.findOne({ where: { botId, month } });

      if (usage) {
        usage.messageCount += 1;
        usage.tokenCount += tokens;
        await this.usageRepo.save(usage);
      } else {
        const newUsage = this.usageRepo.create({
          botId,
          month,
          messageCount: 1,
          tokenCount: tokens,
        });
        await this.usageRepo.save(newUsage);
      }
    } catch (error) {
      this.logger.error(`Error incrementing usage for bot ${botId}:`, error);
    }
  }

  /**
   * Get total usage for a bot (current month and historical).
   */
  async getUsageByBot(botId: string) {
    const month = new Date().toISOString().substring(0, 7);

    const [current, history, totalConversations] = await Promise.all([
      this.usageRepo.findOne({ where: { botId, month } }),
      this.usageRepo.find({
        where: { botId },
        order: { month: 'DESC' },
        take: 12,
      }),
      this.conversationRepo.count({ where: { botId } }),
    ]);

    return {
      current: current || { month, messageCount: 0, tokenCount: 0 },
      history,
      totalConversations,
    };
  }
}
