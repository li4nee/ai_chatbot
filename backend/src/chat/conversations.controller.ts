import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotService } from '../bot/bot.service';
import { ChatService } from './chat.service';
import { ConversationStatus } from './entities/conversation.entity';

class SendAgentMessageDto {
  @IsString()
  @MinLength(1)
  content: string;
}

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
    @Query('status') status?: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    if (status !== undefined && !Object.values(ConversationStatus).includes(status as ConversationStatus)) {
      throw new BadRequestException(`Invalid status filter: ${status}`);
    }
    return this.chatService.getConversationsForBot(
      botId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status as ConversationStatus | undefined,
    );
  }

  @Get(':conversationId')
  async findOne(
    @Request() req,
    @Param('botId') botId: string,
    @Param('conversationId') conversationId: string,
    @Query('after') after?: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.chatService.getTranscript(botId, conversationId, after);
  }

  @Post(':conversationId/takeover')
  async takeover(
    @Request() req,
    @Param('botId') botId: string,
    @Param('conversationId') conversationId: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.chatService.takeoverConversation(botId, conversationId, req.user.id);
  }

  @Post(':conversationId/release')
  async release(
    @Request() req,
    @Param('botId') botId: string,
    @Param('conversationId') conversationId: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.chatService.releaseConversation(botId, conversationId);
  }

  @Post(':conversationId/messages')
  async sendMessage(
    @Request() req,
    @Param('botId') botId: string,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendAgentMessageDto,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.chatService.sendAgentMessage(botId, conversationId, dto.content);
  }
}
