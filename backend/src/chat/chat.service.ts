import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { Bot } from '../bot/entities/bot.entity';
import { UsageService } from '../usage/usage.service';
import { BotService } from '../bot/bot.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private conversationRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    private knowledgeService: KnowledgeService,
    private aiService: AiService,
    private usageService: UsageService,
    private botService: BotService,
  ) {}

  /**
   * Process a chat message from the widget.
   * 1. Find or create conversation by sessionId
   * 2. Save user message
   * 3. Fetch knowledge context (simple RAG)
   * 4. Get conversation history
   * 5. Generate AI response
   * 6. Save and return bot response
   */
  async processMessage(
    bot: Bot,
    userMessage: string,
    sessionId?: string,
  ): Promise<{ reply: string; sessionId: string }> {
    // Fail fast, before touching the conversation/message tables, if this bot
    // has no AI provider key configured (BYOK, no platform fallback).
    const { provider, apiKey } = await this.botService.getChatCredentials(bot.id);

    // Ensure a sessionId exists
    const effectiveSessionId = sessionId || uuidv4();

    // Find or create conversation
    let conversation = await this.conversationRepo.findOne({
      where: { botId: bot.id, sessionId: effectiveSessionId },
    });

    if (!conversation) {
      conversation = this.conversationRepo.create({
        botId: bot.id,
        sessionId: effectiveSessionId,
      });
      conversation = await this.conversationRepo.save(conversation);
    }

    // Save user message
    const userMsg = this.messageRepo.create({
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: userMessage,
    });
    await this.messageRepo.save(userMsg);

    // Get context from knowledge base (Vector Search RAG)
    const context = await this.knowledgeService.getContextForBot(
      bot.id,
      userMessage,
    );

    // Get last 10 messages for conversation history
    const history = await this.messageRepo.find({
      where: { conversationId: conversation.id },
      order: { createdAt: 'ASC' },
      take: 10,
    });

    const conversationHistory = history.slice(0, -1).map((m) => ({
      role: m.role === MessageRole.USER ? 'user' : 'assistant',
      content: m.content,
    }));

    // Generate AI response
    const reply = await this.aiService.generateResponse(
      provider,
      apiKey,
      context,
      userMessage,
      conversationHistory,
    );

    // Save bot response
    const botMsg = this.messageRepo.create({
      conversationId: conversation.id,
      role: MessageRole.BOT,
      content: reply,
    });
    await this.messageRepo.save(botMsg);

    // Track usage (approximating tokens: characters / 4)
    const tokens = Math.ceil((userMessage.length + reply.length) / 4);
    await this.usageService.incrementUsage(bot.id, tokens);

    return { reply, sessionId: effectiveSessionId };
  }

  /** Paginated conversation list for a bot, with message count + a preview of the last message. */
  async getConversationsForBot(
    botId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const [conversations, total] = await this.conversationRepo.findAndCount({
      where: { botId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const data = await Promise.all(
      conversations.map(async (c) => {
        const [messageCount, lastMessage] = await Promise.all([
          this.messageRepo.count({ where: { conversationId: c.id } }),
          this.messageRepo.findOne({
            where: { conversationId: c.id },
            order: { createdAt: 'DESC' },
          }),
        ]);
        return {
          id: c.id,
          sessionId: c.sessionId,
          createdAt: c.createdAt,
          messageCount,
          lastMessagePreview: lastMessage?.content?.slice(0, 140) ?? '',
        };
      }),
    );

    return { data, total, page, limit };
  }

  /** Full ordered transcript for one conversation, scoped to the given bot. */
  async getTranscript(botId: string, conversationId: string) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, botId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const messages = await this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
    return {
      id: conversation.id,
      sessionId: conversation.sessionId,
      createdAt: conversation.createdAt,
      messages,
    };
  }
}
