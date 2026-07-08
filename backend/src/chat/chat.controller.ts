import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { BotThrottlerGuard } from '../common/guards/bot-throttler.guard';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('config')
  @UseGuards(ApiKeyGuard)
  async getConfig(@Request() req) {
    const bot = req.bot;
    return {
      displayName: bot.displayName,
      themeColor: bot.themeColor,
      welcomeMessage: bot.welcomeMessage,
      // Non-secret — safe to expose to the browser. Widget hides the call
      // button when either is missing (bot hasn't configured Vapi/BYOK).
      vapiPublicKey: bot.vapiPublicKey || undefined,
      vapiAssistantId: bot.vapiAssistantId || undefined,
    };
  }

  @Post()
  @UseGuards(ApiKeyGuard, BotThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 messages per minute per bot (was per-IP, and never actually enforced — no guard was wired up)
  async chat(@Request() req, @Body() dto: ChatMessageDto) {
    // bot is attached to request by ApiKeyGuard
    const bot = req.bot;
    return this.chatService.processMessage(bot, dto.message, dto.sessionId);
  }
}
