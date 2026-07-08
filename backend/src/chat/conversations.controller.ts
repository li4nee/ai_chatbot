import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotService } from '../bot/bot.service';
import { ChatService } from './chat.service';

@Controller('bots/:botId/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private chatService: ChatService,
    private botService: BotService,
  ) {}

  @Get()
  async findAll(
    @Request() req,
    @Param('botId') botId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.chatService.getConversationsForBot(
      botId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':conversationId')
  async findOne(
    @Request() req,
    @Param('botId') botId: string,
    @Param('conversationId') conversationId: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.chatService.getTranscript(botId, conversationId);
  }
}
