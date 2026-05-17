import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HubSpotService } from './hubspot.service';

@Module({
  imports: [HttpModule],
  providers: [HubSpotService],
  exports: [HubSpotService],
})
export class CrmModule {}
