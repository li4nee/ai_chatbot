import { Injectable, Logger } from '@nestjs/common';
import { HubSpotService } from '../crm/hubspot.service';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly hubSpotService: HubSpotService) {}

  async handleCallReport(payload: any) {
    const { message } = payload;
    
    if (message?.type === 'end-of-call-report') {
      const summary = message.summary;
      const transcript = message.transcript;
      const recordingUrl = message.recordingUrl;
      const callData = message.call;
      const analysis = message.analysis;

      this.logger.log(`Received Call Report for Call ID: ${callData?.id}`);
      this.logger.log(`Summary: ${summary}`);

      // Sync to CRM (HubSpot)
      const email = analysis?.structuredData?.email || analysis?.email;
      const name = analysis?.structuredData?.name || 'Unknown';
      const phone = callData?.customer?.number || 'Web Call';

      if (email) {
        this.logger.log(`Syncing call to HubSpot for ${email}`);
        const contactId = await this.hubSpotService.createOrUpdateContact({
          email,
          name,
          phone,
        });

        if (contactId) {
          await this.hubSpotService.createCallEngagement(contactId, {
            summary,
            transcript,
            recordingUrl,
          });
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
