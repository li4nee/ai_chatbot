import { Injectable, Logger } from '@nestjs/common';
import { HubSpotService } from '../crm/hubspot.service';
import { CrmSyncFailureService } from '../crm/crm-sync-failure.service';
import { CrmSyncType } from '../crm/entities/crm-sync-failure.entity';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly hubSpotService: HubSpotService,
    private readonly crmSyncFailureService: CrmSyncFailureService,
  ) {}

  async handleCallReport(botId: string, hubspotAccessToken: string | null, payload: any) {
    const { message } = payload;

    if (message?.type === 'end-of-call-report') {
      const summary = message.summary;
      const transcript = message.transcript;
      const recordingUrl = message.recordingUrl;
      const callData = message.call;
      const analysis = message.analysis;

      this.logger.log(`Received Call Report for Call ID: ${callData?.id}`);
      this.logger.log(`Summary: ${summary}`);

      const email = analysis?.structuredData?.email || analysis?.email;
      const name = analysis?.structuredData?.name || 'Unknown';
      const phone = callData?.customer?.number || 'Web Call';

      if (!hubspotAccessToken) {
        this.logger.log(`Bot ${botId} has no HubSpot token configured, skipping CRM sync`);
      } else if (email) {
        this.logger.log(`Syncing call to HubSpot for ${email}`);
        const contactId = await this.hubSpotService.createOrUpdateContact(
          { email, name, phone },
          hubspotAccessToken,
        );

        if (contactId) {
          const noteId = await this.hubSpotService.createCallEngagement(
            contactId,
            {
              summary,
              transcript,
              recordingUrl,
            },
            hubspotAccessToken,
          );
          if (!noteId) {
            this.logger.error(
              `Call engagement sync failed for contact ${contactId}, dead-lettering`,
            );
            await this.crmSyncFailureService.record(
              botId,
              CrmSyncType.CALL_ENGAGEMENT,
              { contactId, summary, transcript, recordingUrl },
              'createCallEngagement failed after retries',
            );
          }
        } else {
          this.logger.error(`Contact sync failed for ${email}, dead-lettering`);
          await this.crmSyncFailureService.record(
            botId,
            CrmSyncType.CONTACT_SYNC,
            { email, name, phone, summary, transcript, recordingUrl },
            'createOrUpdateContact failed after retries',
          );
        }
      } else {
        this.logger.warn('No email found in call analysis, skipping HubSpot sync');
      }

      // Legacy/Internal Update
      await this.updateCRM({
        summary,
        transcript,
        recordingUrl,
        customerName: name,
        customerPhone: phone,
      });
    }
  }

  private async updateCRM(data: any) {
    this.logger.log(`Updating internal CRM records with data: ${JSON.stringify(data)}`);
    // Internal dashboard update logic could go here
  }
}
