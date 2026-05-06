import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from './entities/conversation.entity';
import { Message, MessageRole } from './entities/message.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AiService } from '../ai/ai.service';
import { Bot } from '../bot/entities/bot.entity';
import { UsageService } from '../usage/usage.service';

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

    // Get context from knowledge base (simple RAG — no vectors)
    const context = await this.knowledgeService.getContextForBot(bot.id);

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
}
