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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
    await this.botService.findOne(botId, req.user.id);
    return this.knowledgeService.create(botId, dto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @Request() req,
    @Param('botId') botId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.botService.findOne(botId, req.user.id);
    if (!file) throw new Error('No file uploaded');
    await this.knowledgeService.addKnowledgeFromPdf(botId, file.buffer);
    return { message: 'PDF processed and knowledge added' };
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

  @Delete()
  async removeAll(
    @Request() req,
    @Param('botId') botId: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    await this.knowledgeService.removeAllByBot(botId);
    return { message: 'All knowledge deleted for this bot' };
  }

  @Delete(':id')
  async remove(
    @Request() req,
    @Param('botId') botId: string,
    @Param('id') id: string,
  ) {
    await this.botService.findOne(botId, req.user.id);
    return this.knowledgeService.remove(id);
  }
}
