import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bot } from './entities/bot.entity';
import { BotService } from './bot.service';
import { BotController } from './bot.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bot])],
  providers: [BotService],
  controllers: [BotController],
  exports: [BotService],
})
export class BotModule {}
