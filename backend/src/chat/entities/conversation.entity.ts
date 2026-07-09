import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Bot } from '../../bot/entities/bot.entity';
import { Message } from './message.entity';

export enum ConversationStatus {
  BOT = 'BOT',
  NEEDS_HUMAN = 'NEEDS_HUMAN',
  HUMAN = 'HUMAN',
}

@Entity('conversations')
@Index(['botId', 'sessionId']) // every chat/handoff lookup keys off this pair, now polled every ~4s too
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique session identifier from the chat widget */
  @Column()
  sessionId: string;

  @Column()
  botId: string;

  @ManyToOne(() => Bot, (bot) => bot.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot: Bot;

  @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.BOT })
  status: ConversationStatus;

  @Column({ type: 'uuid', nullable: true })
  assignedAdminId: string | null;

  @OneToMany(() => Message, (m) => m.conversation)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;
}
