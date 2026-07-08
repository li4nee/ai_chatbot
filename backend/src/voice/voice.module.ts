import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { CrmModule } from '../crm/crm.module';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [CrmModule, BotModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
