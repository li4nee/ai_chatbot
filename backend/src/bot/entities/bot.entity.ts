import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Knowledge } from '../../knowledge/entities/knowledge.entity';
import { Conversation } from '../../chat/entities/conversation.entity';
import { AiProvider } from '../../ai/ai-provider.enum';

@Entity('bots')
export class Bot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'AI Assistant' })
  displayName: string;

  @Column({ default: '#6366f1' })
  themeColor: string;

  @Column({ default: '👋 Hi there! How can I help you today?' })
  welcomeMessage: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  pricePer1kTokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  pricePerMessage: number;

  @Column({ unique: true })
  apiKey: string;

  // Opt-in per bot — lets visitors request a human agent in the widget.
  @Column({ default: false })
  humanHandoffEnabled: boolean;

  // ── BYOK credentials ──
  // Secret values below are AES-256-GCM encrypted (see EncryptionService) and
  // excluded from default queries — fetch via BotService's dedicated methods.

  // Chat provider — which AI this bot answers with, and its key.
  @Column({ type: 'enum', enum: AiProvider, default: AiProvider.GEMINI })
  aiProvider: AiProvider;

  @Column({ type: 'text', nullable: true, select: false })
  aiApiKeyEncrypted: string | null;

  // Only set when `aiProvider` is chat-only (Anthropic/Groq have no embeddings
  // API) — a bot in that case brings a second, embeddings-capable key.
  @Column({ type: 'enum', enum: AiProvider, nullable: true })
  embeddingProvider: AiProvider | null;

  @Column({ type: 'text', nullable: true, select: false })
  embeddingApiKeyEncrypted: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  hubspotAccessTokenEncrypted: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  vapiWebhookSecretEncrypted: string | null;

  // Publishable/client-safe — served to the widget as-is, never encrypted.
  @Column({ type: 'text', nullable: true })
  vapiPublicKey: string | null;

  @Column({ type: 'text', nullable: true })
  vapiAssistantId: string | null;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.bots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => Knowledge, (k) => k.bot)
  knowledgeChunks: Knowledge[];

  @OneToMany(() => Conversation, (c) => c.bot)
  conversations: Conversation[];

  @CreateDateColumn()
  createdAt: Date;
}
