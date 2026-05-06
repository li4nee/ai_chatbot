import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BotService } from '../bot/bot.service';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/create-knowledge.dto';

@Controller('bots/:botId/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private knowledgeService: KnowledgeService,
    private botService: BotService,
  ) {}

  @Post()
  async create(
    @Request() req,
    @Param('botId') botId: string,
    @Body() dto: CreateKnowledgeDto,
  ) {
    // Verify the bot belongs to the user
    await this.botService.findOne(botId, req.user.id);
    return this.knowledgeService.create(botId, dto);
  }

  @Get()
  async findAll(
    @Request() req,
    @Param('botId') botId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.knowledgeService.findAllByBot(
      botId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(':id')
  async update(
    @Request() req,
    @Param('botId') botId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.knowledgeService.update(id, dto);
  }
}
