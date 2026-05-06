import {
  Controller,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KnowledgeService } from './knowledge.service';
import { UpdateKnowledgeDto } from './dto/create-knowledge.dto';

/**
 * Standalone endpoints for operating on a knowledge chunk by its ID
 * (without needing botId in the URL path).
 */
@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeDeleteController {
  constructor(private knowledgeService: KnowledgeService) {}

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    await this.knowledgeService.removeWithOwnerCheck(id, req.user.id);
    return { message: 'Knowledge chunk deleted' };
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateKnowledgeDto) {
    return this.knowledgeService.updateWithOwnerCheck(id, req.user.id, dto);
  }
}
