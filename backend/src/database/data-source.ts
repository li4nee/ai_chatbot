import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../auth/entities/user.entity';
import { Bot } from '../bot/entities/bot.entity';
import { Knowledge } from '../knowledge/entities/knowledge.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { Message } from '../chat/entities/message.entity';
import { Usage } from '../usage/entities/usage.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ai_chatbot',
  entities: [User, Bot, Knowledge, Conversation, Message, Usage],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: process.env.NODE_ENV === 'production' ? false : true,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
