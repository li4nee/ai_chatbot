import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, ConversationStatus } from './entities/conversation.entity';
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
  ): Promise<{ reply: string; sessionId: string; status: ConversationStatus }> {
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

    // A human has taken over (or one's been requested) — don't let the AI talk
    // over them. The widget picks up the actual agent reply via polling.
    if (conversation.status !== ConversationStatus.BOT) {
      return { reply: '', sessionId: effectiveSessionId, status: conversation.status };
    }

    // Fail fast if this bot has no AI provider key configured (BYOK, no platform fallback).
    const { provider, apiKey } = await this.botService.getChatCredentials(bot.id);

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

    return { reply, sessionId: effectiveSessionId, status: conversation.status };
  }

  /** Visitor-initiated handoff request — only valid if the bot has opted in. */
  async requestHuman(bot: Bot, sessionId: string): Promise<{ status: ConversationStatus }> {
    if (!bot.humanHandoffEnabled) {
      throw new BadRequestException('This bot does not have live agent handoff enabled');
    }

    let conversation = await this.conversationRepo.findOne({
      where: { botId: bot.id, sessionId },
    });
    if (!conversation) {
      // repo.create() only calls `new Conversation()` — it does not apply
      // @Column({ default }) values in memory (those are schema-level, applied
      // by Postgres on INSERT). Set status explicitly so the check below sees
      // 'BOT' instead of undefined and doesn't silently skip the save.
      conversation = this.conversationRepo.create({ botId: bot.id, sessionId, status: ConversationStatus.BOT });
    }
    if (conversation.status === ConversationStatus.BOT) {
      conversation.status = ConversationStatus.NEEDS_HUMAN;
      conversation = await this.conversationRepo.save(conversation);
    }
    return { status: conversation.status };
  }

  /** Polling endpoint for the widget — messages newer than `after`, plus current status. */
  async getMessagesSince(
    botId: string,
    sessionId: string,
    after?: string,
  ): Promise<{ status: ConversationStatus; messages: Message[] }> {
    const conversation = await this.conversationRepo.findOne({
      where: { botId, sessionId },
    });
    if (!conversation) {
      return { status: ConversationStatus.BOT, messages: [] };
    }

    const messages = await this.messageRepo.find({
      where: {
        conversationId: conversation.id,
        ...(after ? { createdAt: MoreThan(new Date(after)) } : {}),
      },
      order: { createdAt: 'ASC' },
    });
    return { status: conversation.status, messages };
  }

  /** Admin takes over a conversation from the bot. */
  async takeoverConversation(botId: string, conversationId: string, adminId: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId, botId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    conversation.status = ConversationStatus.HUMAN;
    conversation.assignedAdminId = adminId;
    return this.conversationRepo.save(conversation);
  }

  /** Admin hands the conversation back to the bot. */
  async releaseConversation(botId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId, botId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    conversation.status = ConversationStatus.BOT;
    conversation.assignedAdminId = null;
    return this.conversationRepo.save(conversation);
  }

  /** Admin sends a message into the conversation as a human agent. */
  async sendAgentMessage(botId: string, conversationId: string, content: string): Promise<Message> {
    const conversation = await this.conversationRepo.findOne({ where: { id: conversationId, botId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const message = this.messageRepo.create({
      conversationId,
      role: MessageRole.AGENT,
      content,
    });
    return this.messageRepo.save(message);
  }

  /** Paginated conversation list for a bot, with message count + a preview of the last message. */
  async getConversationsForBot(
    botId: string,
    page = 1,
    limit = 20,
    status?: ConversationStatus,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const [conversations, total] = await this.conversationRepo.findAndCount({
      where: status ? { botId, status } : { botId },
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
          status: c.status,
          messageCount,
          lastMessagePreview: lastMessage?.content?.slice(0, 140) ?? '',
        };
      }),
    );

    return { data, total, page, limit };
  }

  /**
   * Transcript for one conversation, scoped to the given bot. Pass `after` to
   * get only messages newer than that timestamp — used for incremental polling
   * from the admin UI instead of re-fetching the whole history every tick.
   */
  async getTranscript(botId: string, conversationId: string, after?: string) {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, botId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const messages = await this.messageRepo.find({
      where: {
        conversationId,
        ...(after ? { createdAt: MoreThan(new Date(after)) } : {}),
      },
      order: { createdAt: 'ASC' },
    });
    return {
      id: conversation.id,
      sessionId: conversation.sessionId,
      createdAt: conversation.createdAt,
      status: conversation.status,
      messages,
    };
  }
}
