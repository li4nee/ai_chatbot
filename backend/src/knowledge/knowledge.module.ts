import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Knowledge } from './entities/knowledge.entity';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeDeleteController } from './knowledge-delete.controller';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [TypeOrmModule.forFeature([Knowledge]), BotModule],
  providers: [KnowledgeService],
  controllers: [KnowledgeController, KnowledgeDeleteController],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
