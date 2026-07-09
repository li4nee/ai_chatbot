import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrmSyncFailureService } from './crm-sync-failure.service';
import { CrmSyncStatus } from './entities/crm-sync-failure.entity';

@Controller('crm/sync-failures')
@UseGuards(JwtAuthGuard)
export class CrmSyncFailureController {
  constructor(private crmSyncFailureService: CrmSyncFailureService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('status') status?: CrmSyncStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crmSyncFailureService.findAll(
      req.user,
      status,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post(':id/retry')
  async retry(@Request() req, @Param('id') id: string) {
    return this.crmSyncFailureService.retryOne(id, req.user);
  }
}
