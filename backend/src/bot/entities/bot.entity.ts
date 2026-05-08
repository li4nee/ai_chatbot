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

  // Future: live agent handoff support
  @Column({ default: false })
  isHumanActive: boolean;

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
