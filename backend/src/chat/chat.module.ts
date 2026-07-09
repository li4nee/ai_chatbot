import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ConversationsController } from './conversations.controller';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { UsageModule } from '../usage/usage.module';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message]),
    KnowledgeModule,
    AiModule,
    AuthModule,
    UsageModule,
    BotModule,
  ],
  providers: [ChatService],
  controllers: [ChatController, ConversationsController],
})
export class ChatModule {}
