import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrmSyncFailureService } from './crm-sync-failure.service';
import { CrmSyncStatus } from './entities/crm-sync-failure.entity';

@Controller('crm/sync-failures')
@UseGuards(JwtAuthGuard)
export class CrmSyncFailureController {
  constructor(private crmSyncFailureService: CrmSyncFailureService) {}

  @Get()
  async findAll(
    @Query('status') status?: CrmSyncStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crmSyncFailureService.findAll(
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    return this.crmSyncFailureService.retryOne(id);
  }
}
