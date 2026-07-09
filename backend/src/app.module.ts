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

import { VoiceModule } from './voice/voice.module';
import { CrmModule } from './crm/crm.module';
import { CrmSyncFailure } from './crm/entities/crm-sync-failure.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from './common/common.module';
import { perVisitorTracker, perBotTracker } from './common/throttler-trackers';

@Module({
  imports: [
    // Load .env file
    ConfigModule.forRoot({ isGlobal: true }),

    // Encryption utility for BYOK credentials (Global — available everywhere)
    CommonModule,

    // Enables @Cron() jobs (used for dead-letter retry of failed CRM syncs)
    ScheduleModule.forRoot(),

    // Rate limiting. `default` is a generic per-IP backstop (unused unless a
    // route opts in). Chat uses two purpose-built tiers instead — see
    // ChatController.chat: `perVisitor` stops one visitor from spamming a
    // bot, `perBot` is a much higher ceiling across all of that bot's
    // concurrent visitors, so 100 people chatting with the same bot don't
    // collide in one shared bucket.
    ThrottlerModule.forRoot({
      throttlers: [
        { ttl: 60000, limit: 20 },
        {
          name: 'perVisitor',
          ttl: 60000,
          limit: 20,
          getTracker: perVisitorTracker,
        },
        {
          name: 'perBot',
          ttl: 60000,
          limit: 500,
          getTracker: perBotTracker,
        },
      ],
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
        entities: [
          User,
          Bot,
          Knowledge,
          Conversation,
          Message,
          Usage,
          CrmSyncFailure,
        ],
        synchronize: config.get('NODE_ENV') !== 'production', // Disable auto-sync in production
        ssl:
          config.get('DB_SSL') === 'true' ||
          config.get('NODE_ENV') === 'production'
            ? { rejectUnauthorized: false }
            : false,
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
    VoiceModule,
    CrmModule,
  ],
})
export class AppModule {}
