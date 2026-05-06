import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Bot } from '../../bot/entities/bot.entity';

@Entity('knowledge')
export class Knowledge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column()
  botId: string;

  @ManyToOne(() => Bot, (bot) => bot.knowledgeChunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'botId' })
  bot: Bot;

  @Column('float8', { array: true, nullable: true })
  embedding: number[];

  @CreateDateColumn()
  createdAt: Date;
}
