import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotService } from './bot.service';
import { CreateBotDto, UpdateBotDto } from './dto/create-bot.dto';

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotController {
  constructor(private botService: BotService) {}

  @Post()
  async create(@Request() req, @Body() dto: CreateBotDto) {
    return this.botService.create(req.user.id, dto);
  }

  @Get()
  async findAll(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.botService.findAllByUser(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.botService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateBotDto) {
    return this.botService.update(id, req.user.id, dto);
  }

  /** Regenerate the bot's API key */
  @Post(':id/rotate-key')
  async rotateKey(@Request() req, @Param('id') id: string) {
    return this.botService.rotateApiKey(id, req.user.id);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.botService.remove(id, req.user.id);
    return { message: 'Bot deleted' };
  }
}
