import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
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
    };
  }

  @Post()
  @UseGuards(ApiKeyGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 messages per minute per IP
  async chat(@Request() req, @Body() dto: ChatMessageDto) {
    // bot is attached to request by ApiKeyGuard
    const bot = req.bot;
    return this.chatService.processMessage(bot, dto.message, dto.sessionId);
  }
}
