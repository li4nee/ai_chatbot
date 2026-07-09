import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiClientFactory } from './ai-client.factory';

@Module({
  providers: [AiService, AiClientFactory],
  exports: [AiService],
})
export class AiModule {}
