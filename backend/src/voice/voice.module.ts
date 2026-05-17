import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [CrmModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
