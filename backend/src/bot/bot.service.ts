import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Bot } from './entities/bot.entity';
import { CreateBotDto, UpdateBotDto } from './dto/create-bot.dto';
import { EncryptionService } from '../common/encryption.service';
import { AiProvider, supportsEmbeddings } from '../ai/ai-provider.enum';

export interface VoiceConfig {
  id: string;
  hubspotAccessToken: string | null;
  vapiWebhookSecret: string | null;
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectRepository(Bot)
    private botRepo: Repository<Bot>,
    private encryptionService: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateBotDto): Promise<Bot> {
    const bot = this.botRepo.create({
      ...dto,
      userId,
      apiKey: `bot_${uuidv4().replace(/-/g, '')}`,
    });
    const saved = await this.botRepo.save(bot);
    this.logger.log(`Bot created: ${saved.id} by user ${userId}`);
    return saved;
  }

  /** Paginated bot list for a user */
  async findAllByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Bot[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.botRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: string, userId: string): Promise<Bot> {
    const bot = await this.botRepo.findOne({ where: { id } });
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    if (bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return bot;
  }

  /** Update bot settings. BYOK credential fields are encrypted before storage; an empty string clears the stored credential, omitting the field leaves it untouched. */
  async update(id: string, userId: string, dto: UpdateBotDto): Promise<Bot> {
    const bot = await this.findOne(id, userId);
    const { aiApiKey, hubspotAccessToken, vapiWebhookSecret, embeddingApiKey, ...rest } = dto;

    Object.assign(bot, rest);

    if (aiApiKey !== undefined) {
      bot.aiApiKeyEncrypted = aiApiKey ? this.encryptionService.encrypt(aiApiKey) : null;
    }
    if (embeddingApiKey !== undefined) {
      bot.embeddingApiKeyEncrypted = embeddingApiKey ? this.encryptionService.encrypt(embeddingApiKey) : null;
    }
    if (hubspotAccessToken !== undefined) {
      bot.hubspotAccessTokenEncrypted = hubspotAccessToken
        ? this.encryptionService.encrypt(hubspotAccessToken)
        : null;
    }
    if (vapiWebhookSecret !== undefined) {
      bot.vapiWebhookSecretEncrypted = vapiWebhookSecret
        ? this.encryptionService.encrypt(vapiWebhookSecret)
        : null;
    }

    const updated = await this.botRepo.save(bot);
    this.logger.log(`Bot updated: ${id}`);
    return updated;
  }

  /** Regenerate API key for a bot */
  async rotateApiKey(id: string, userId: string): Promise<Bot> {
    const bot = await this.findOne(id, userId);
    bot.apiKey = `bot_${uuidv4().replace(/-/g, '')}`;
    const updated = await this.botRepo.save(bot);
    this.logger.warn(`API key rotated for bot: ${id} by user ${userId}`);
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const bot = await this.findOne(id, userId);
    await this.botRepo.remove(bot);
    this.logger.log(`Bot deleted: ${id} by user ${userId}`);
  }

  /** Decrypted chat provider + key for a bot — required for chat; throws if not configured (BYOK, no platform fallback). */
  async getChatCredentials(botId: string): Promise<{ provider: AiProvider; apiKey: string }> {
    const bot = await this.botRepo
      .createQueryBuilder('bot')
      .addSelect('bot.aiApiKeyEncrypted')
      .where('bot.id = :botId', { botId })
      .getOne();

    if (!bot?.aiApiKeyEncrypted) {
      throw new BadRequestException(
        'This bot has no AI provider key configured. Add one in the bot\'s Integrations settings.',
      );
    }
    return { provider: bot.aiProvider, apiKey: this.encryptionService.decrypt(bot.aiApiKeyEncrypted) };
  }

  /**
   * Decrypted embedding provider + key for a bot's knowledge base. Reuses the
   * chat key when `aiProvider` itself supports embeddings (Gemini/OpenAI/Mistral —
   * the common case, no extra setup). When `aiProvider` is chat-only
   * (Anthropic/Groq), a separate `embeddingProvider`/`embeddingApiKeyEncrypted`
   * is required and this throws if it hasn't been configured.
   */
  async getEmbeddingCredentials(botId: string): Promise<{ provider: AiProvider; apiKey: string }> {
    const bot = await this.botRepo
      .createQueryBuilder('bot')
      .addSelect(['bot.aiApiKeyEncrypted', 'bot.embeddingApiKeyEncrypted'])
      .where('bot.id = :botId', { botId })
      .getOne();

    if (!bot) {
      throw new BadRequestException('Bot not found');
    }

    if (supportsEmbeddings(bot.aiProvider)) {
      if (!bot.aiApiKeyEncrypted) {
        throw new BadRequestException(
          'This bot has no AI provider key configured. Add one in the bot\'s Integrations settings.',
        );
      }
      return { provider: bot.aiProvider, apiKey: this.encryptionService.decrypt(bot.aiApiKeyEncrypted) };
    }

    if (!bot.embeddingProvider || !bot.embeddingApiKeyEncrypted) {
      throw new BadRequestException(
        `This bot uses ${bot.aiProvider} for chat, which doesn't support embeddings — configure a Gemini, OpenAI, or Mistral key for knowledge search in the bot's Integrations settings.`,
      );
    }
    return {
      provider: bot.embeddingProvider,
      apiKey: this.encryptionService.decrypt(bot.embeddingApiKeyEncrypted),
    };
  }

  /** Decrypted, optional integration credentials — null when not configured, no error thrown. */
  async getIntegrationCredentials(
    botId: string,
  ): Promise<{ hubspotAccessToken: string | null; vapiWebhookSecret: string | null }> {
    const bot = await this.botRepo
      .createQueryBuilder('bot')
      .addSelect(['bot.hubspotAccessTokenEncrypted', 'bot.vapiWebhookSecretEncrypted'])
      .where('bot.id = :botId', { botId })
      .getOne();

    return {
      hubspotAccessToken: bot?.hubspotAccessTokenEncrypted
        ? this.encryptionService.decrypt(bot.hubspotAccessTokenEncrypted)
        : null,
      vapiWebhookSecret: bot?.vapiWebhookSecretEncrypted
        ? this.encryptionService.decrypt(bot.vapiWebhookSecretEncrypted)
        : null,
    };
  }

  /** Presence-only flags for the admin UI — never exposes the encrypted values themselves. */
  async getCredentialFlags(botId: string): Promise<{
    aiProvider: AiProvider;
    hasAiApiKey: boolean;
    embeddingProvider: AiProvider | null;
    hasEmbeddingApiKey: boolean;
    hasHubspotAccessToken: boolean;
    hasVapiWebhookSecret: boolean;
  }> {
    const bot = await this.botRepo
      .createQueryBuilder('bot')
      .addSelect([
        'bot.aiApiKeyEncrypted',
        'bot.embeddingApiKeyEncrypted',
        'bot.hubspotAccessTokenEncrypted',
        'bot.vapiWebhookSecretEncrypted',
      ])
      .where('bot.id = :botId', { botId })
      .getOne();

    return {
      aiProvider: bot?.aiProvider ?? AiProvider.GEMINI,
      hasAiApiKey: !!bot?.aiApiKeyEncrypted,
      embeddingProvider: bot?.embeddingProvider ?? null,
      hasEmbeddingApiKey: !!bot?.embeddingApiKeyEncrypted,
      hasHubspotAccessToken: !!bot?.hubspotAccessTokenEncrypted,
      hasVapiWebhookSecret: !!bot?.vapiWebhookSecretEncrypted,
    };
  }

  /** Bot lookup for the voice webhook — no authenticated user to check ownership against. */
  async findByIdWithVoiceConfig(botId: string): Promise<VoiceConfig | null> {
    const bot = await this.botRepo.findOne({ where: { id: botId } });
    if (!bot) return null;
    const credentials = await this.getIntegrationCredentials(botId);
    return { id: bot.id, ...credentials };
  }
}
