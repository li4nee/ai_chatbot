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

/**
 * class-transformer's plainToInstance (used by the global ValidationPipe with
 * transform:true) sets every declared DTO field as an own property, `undefined`
 * for whatever wasn't in the request body — not merely absent. Object.assign
 * would happily copy those `undefined`s onto the entity, blanking out fields
 * the caller never touched in the object we return (TypeORM itself correctly
 * skips `undefined` columns when persisting, so this never corrupts the DB —
 * only the in-memory entity we hand back).
 */
function pickDefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

type EncryptedFieldName =
  | 'aiApiKeyEncrypted'
  | 'embeddingApiKeyEncrypted'
  | 'hubspotAccessTokenEncrypted'
  | 'vapiWebhookSecretEncrypted';

export interface SafeBot extends Omit<Bot, EncryptedFieldName> {
  hasAiApiKey: boolean;
  hasEmbeddingApiKey: boolean;
  hasHubspotAccessToken: boolean;
  hasVapiWebhookSecret: boolean;
}

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectRepository(Bot)
    private botRepo: Repository<Bot>,
    private encryptionService: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateBotDto): Promise<SafeBot> {
    const bot = this.botRepo.create({
      ...dto,
      userId,
      apiKey: `bot_${uuidv4().replace(/-/g, '')}`,
    });
    const saved = await this.botRepo.save(bot);
    this.logger.log(`Bot created: ${saved.id} by user ${userId}`);
    return this.toSafeBot(saved);
  }

  /** Bot IDs owned by a user — for services that need to scope a query to "this user's bots" without hand-rolling a join. */
  async findOwnedBotIds(userId: string): Promise<string[]> {
    const bots = await this.botRepo.find({ where: { userId }, select: ['id'] });
    return bots.map((b) => b.id);
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
  async update(id: string, userId: string, dto: UpdateBotDto): Promise<SafeBot> {
    const bot = await this.findOneWithCredentials(id, userId);
    const { aiApiKey, hubspotAccessToken, vapiWebhookSecret, embeddingApiKey, ...rest } = dto;

    Object.assign(bot, pickDefined(rest));

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
    return this.toSafeBot(updated);
  }

  /** Regenerate API key for a bot */
  async rotateApiKey(id: string, userId: string): Promise<SafeBot> {
    const bot = await this.findOneWithCredentials(id, userId);
    bot.apiKey = `bot_${uuidv4().replace(/-/g, '')}`;
    const updated = await this.botRepo.save(bot);
    this.logger.warn(`API key rotated for bot: ${id} by user ${userId}`);
    return this.toSafeBot(updated);
  }

  /** Bot for the admin UI's GET /bots/:id — credential presence flags, never the encrypted values. */
  async getSafeBotForOwner(id: string, userId: string): Promise<SafeBot> {
    const bot = await this.findOneWithCredentials(id, userId);
    return this.toSafeBot(bot);
  }

  /**
   * Like findOne, but with the encrypted credential columns selected — needed
   * whenever we're about to save the entity and return a safe view of it,
   * since select:false columns not touched by this call would otherwise read
   * as undefined (and `toSafeBot` would report them as "not configured" even
   * when a value from a previous update is still sitting in the DB). An
   * explicit `select` list still returns select:false columns — it's only the
   * *default* wildcard select that skips them — so this needs every column,
   * not just the encrypted ones.
   */
  private async findOneWithCredentials(id: string, userId: string): Promise<Bot> {
    const bot = await this.botRepo.findOne({
      where: { id },
      select: [
        'id',
        'name',
        'displayName',
        'themeColor',
        'welcomeMessage',
        'pricePer1kTokens',
        'pricePerMessage',
        'apiKey',
        'humanHandoffEnabled',
        'aiProvider',
        'aiApiKeyEncrypted',
        'embeddingProvider',
        'embeddingApiKeyEncrypted',
        'hubspotAccessTokenEncrypted',
        'vapiPublicKey',
        'vapiAssistantId',
        'vapiWebhookSecretEncrypted',
        'userId',
        'createdAt',
      ],
    });
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    if (bot.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return bot;
  }

  /** Strips encrypted columns from a bot that has them loaded, replacing them with presence-only flags. */
  private toSafeBot(bot: Bot): SafeBot {
    const {
      aiApiKeyEncrypted,
      embeddingApiKeyEncrypted,
      hubspotAccessTokenEncrypted,
      vapiWebhookSecretEncrypted,
      ...rest
    } = bot;
    return {
      ...rest,
      hasAiApiKey: !!aiApiKeyEncrypted,
      hasEmbeddingApiKey: !!embeddingApiKeyEncrypted,
      hasHubspotAccessToken: !!hubspotAccessTokenEncrypted,
      hasVapiWebhookSecret: !!vapiWebhookSecretEncrypted,
    };
  }

  async remove(id: string, userId: string): Promise<void> {
    const bot = await this.findOne(id, userId);
    await this.botRepo.remove(bot);
    this.logger.log(`Bot deleted: ${id} by user ${userId}`);
  }

  /** Decrypted chat provider + key for a bot — required for chat; throws if not configured (BYOK, no platform fallback). */
  async getChatCredentials(botId: string): Promise<{ provider: AiProvider; apiKey: string }> {
    const bot = await this.botRepo.findOne({
      where: { id: botId },
      select: ['id', 'aiProvider', 'aiApiKeyEncrypted'],
    });

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
    const bot = await this.botRepo.findOne({
      where: { id: botId },
      select: ['id', 'aiProvider', 'aiApiKeyEncrypted', 'embeddingProvider', 'embeddingApiKeyEncrypted'],
    });

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
    const bot = await this.botRepo.findOne({
      where: { id: botId },
      select: ['id', 'hubspotAccessTokenEncrypted', 'vapiWebhookSecretEncrypted'],
    });

    return {
      hubspotAccessToken: bot?.hubspotAccessTokenEncrypted
        ? this.encryptionService.decrypt(bot.hubspotAccessTokenEncrypted)
        : null,
      vapiWebhookSecret: bot?.vapiWebhookSecretEncrypted
        ? this.encryptionService.decrypt(bot.vapiWebhookSecretEncrypted)
        : null,
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
