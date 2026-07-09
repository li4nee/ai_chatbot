import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard, SkipThrottle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ChatService } from './chat.service';
import { ChatMessageDto, RequestHumanDto } from './dto/chat-message.dto';

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
      humanHandoffEnabled: bot.humanHandoffEnabled,
      // Non-secret — safe to expose to the browser. Widget hides the call
      // button when either is missing (bot hasn't configured Vapi/BYOK).
      vapiPublicKey: bot.vapiPublicKey || undefined,
      vapiAssistantId: bot.vapiAssistantId || undefined,
    };
  }

  @Post()
  @UseGuards(ApiKeyGuard, ThrottlerGuard)
  @SkipThrottle() // skip the generic per-IP 'default' profile — the two tiers below replace it
  @Throttle({
    perVisitor: { limit: 20, ttl: 60000 }, // stops one visitor from spamming this bot
    perBot: { limit: 500, ttl: 60000 }, // ceiling across all of this bot's concurrent visitors — many real visitors don't share one small bucket anymore
  })
  async chat(@Request() req, @Body() dto: ChatMessageDto) {
    // bot is attached to request by ApiKeyGuard
    const bot = req.bot;
    return this.chatService.processMessage(bot, dto.message, dto.sessionId);
  }

  @Post('request-human')
  @UseGuards(ApiKeyGuard, ThrottlerGuard)
  @SkipThrottle()
  @Throttle({
    perVisitor: { limit: 5, ttl: 60000 },
    perBot: { limit: 500, ttl: 60000 },
  })
  async requestHuman(@Request() req, @Body() dto: RequestHumanDto) {
    return this.chatService.requestHuman(req.bot, dto.sessionId);
  }

  /** Polling endpoint — picks up agent replies and status changes the synchronous POST /chat doesn't return. */
  @Get('messages')
  @UseGuards(ApiKeyGuard, ThrottlerGuard)
  @SkipThrottle()
  @Throttle({
    perVisitor: { limit: 30, ttl: 60000 }, // covers the widget's own ~15/min polling cadence with headroom
    perBot: { limit: 3000, ttl: 60000 }, // enough for ~100 concurrent visitors polling every 4s
  })
  async getMessages(
    @Request() req,
    @Query('sessionId') sessionId: string,
    @Query('after') after?: string,
  ) {
    // A missing sessionId would otherwise be passed straight into a TypeORM
    // `where` clause as `undefined`, which TypeORM silently drops from the
    // query — returning an arbitrary conversation for this bot instead of
    // the caller's own.
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    return this.chatService.getMessagesSince(req.bot.id, sessionId, after);
  }
}
