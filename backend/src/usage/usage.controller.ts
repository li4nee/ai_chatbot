import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsageService } from './usage.service';
import { BotService } from '../bot/bot.service';

@Controller('bots/:botId/usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(
    private usageService: UsageService,
    private botService: BotService,
  ) {}

  @Get()
  async getUsage(@Request() req, @Param('botId') botId: string) {
    // Verify bot ownership
    await this.botService.findOne(botId, req.user.id);
    return this.usageService.getUsageByBot(botId);
  }
}
