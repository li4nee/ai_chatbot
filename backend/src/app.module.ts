import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { ChatModule } from './chat/chat.module';
import { AiModule } from './ai/ai.module';
import { WidgetModule } from './widget/widget.module';


// Entities
import { User } from './auth/entities/user.entity';
import { Bot } from './bot/entities/bot.entity';
import { Knowledge } from './knowledge/entities/knowledge.entity';
import { Conversation } from './chat/entities/conversation.entity';
import { Message } from './chat/entities/message.entity';
import { Usage } from './usage/entities/usage.entity';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    // Load .env file
    ConfigModule.forRoot({ isGlobal: true }),


    // Rate limiting: 20 requests per 60 seconds per IP
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 20 }],
    }),

    // PostgreSQL connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'ai_chatbot'),
        entities: [User, Bot, Knowledge, Conversation, Message, Usage],
        synchronize: true, // Auto-sync schema in dev — disable in production
        ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),

    // Feature modules
    AuthModule,
    BotModule,
    KnowledgeModule,
    ChatModule,
    AiModule,
    WidgetModule,
    UsageModule,
  ],
})
export class AppModule {}
