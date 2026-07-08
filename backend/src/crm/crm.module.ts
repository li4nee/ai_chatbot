import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubSpotService } from './hubspot.service';
import { CrmSyncFailure } from './entities/crm-sync-failure.entity';
import { CrmSyncFailureService } from './crm-sync-failure.service';
import { CrmSyncFailureController } from './crm-sync-failure.controller';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([CrmSyncFailure]), BotModule],
  providers: [HubSpotService, CrmSyncFailureService],
  controllers: [CrmSyncFailureController],
  exports: [HubSpotService, CrmSyncFailureService],
})
export class CrmModule {}
