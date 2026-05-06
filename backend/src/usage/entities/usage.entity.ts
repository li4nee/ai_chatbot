import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Bot } from '../../bot/entities/bot.entity';

@Entity('usage')
@Unique(['botId', 'month']) // One record per bot per month
export class Usage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  botId: string;

  @ManyToOne(() => Bot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot: Bot;

  @Column()
  month: string; // Format: YYYY-MM

  @Column({ default: 0 })
  messageCount: number;

  @Column({ default: 0 })
  tokenCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
