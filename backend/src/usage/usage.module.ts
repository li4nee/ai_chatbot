import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usage } from './entities/usage.entity';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [TypeOrmModule.forFeature([Usage]), BotModule],
  providers: [UsageService],
  controllers: [UsageController],
  exports: [UsageService],
})
export class UsageModule {}
