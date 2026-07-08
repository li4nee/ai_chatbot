import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { VoiceService } from './voice.service';
import { BotService } from '../bot/bot.service';

// Header Vapi sends back the assistant's configured "Server URL Secret" on, per
// Vapi's server-webhook auth docs. Verified only when a bot has one configured —
// worth double-checking against current Vapi docs if this stops matching.
const VAPI_SECRET_HEADER = 'x-vapi-secret';

@Controller('voice')
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);

  constructor(
    private readonly voiceService: VoiceService,
    private readonly botService: BotService,
  ) {}

  /**
   * Bot-scoped webhook — each bot's own Vapi assistant is configured (in the
   * Vapi dashboard) to POST here, so BYOK credentials can be resolved per call.
   */
  @Post('webhook/:botId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('botId') botId: string,
    @Body() payload: any,
    @Headers(VAPI_SECRET_HEADER) vapiSecretHeader: string | undefined,
  ) {
    const voiceConfig = await this.botService.findByIdWithVoiceConfig(botId);
    if (!voiceConfig) {
      throw new NotFoundException('Bot not found');
    }

    if (voiceConfig.vapiWebhookSecret) {
      if (voiceConfig.vapiWebhookSecret !== vapiSecretHeader) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    } else {
      this.logger.warn(
        `Bot ${botId} has no Vapi webhook secret configured — accepting unverified webhook`,
      );
    }

    return this.voiceService.handleCallReport(botId, voiceConfig.hubspotAccessToken, payload);
  }
}
