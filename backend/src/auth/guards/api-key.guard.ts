import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot } from '../../bot/entities/bot.entity';

/**
 * Guard for widget/chat endpoints.
 * Validates the bot API key from the x-bot-api-key header.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(Bot)
    private botRepo: Repository<Bot>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-bot-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const bot = await this.botRepo.findOne({ where: { apiKey } });
    if (!bot) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach bot to request for downstream use
    request.bot = bot;
    return true;
  }
}
