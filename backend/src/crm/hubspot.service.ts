import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);
  private readonly baseUrl = 'https://api.hubapi.com/crm/v3';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get headers() {
    const token = this.configService.get<string>('HUBSPOT_ACCESS_TOKEN');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Search for a contact by email, or create a new one if it doesn't exist.
   */
  async createOrUpdateContact(data: { email: string; name?: string; phone?: string }) {
    try {
      const { email, name, phone } = data;
      this.logger.log(`Searching for HubSpot contact: ${email}`);

      // Search for contact
      const searchResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/objects/contacts/search`,
          {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'EQ',
                    value: email,
                  },
                ],
              },
            ],
          },
          { headers: this.headers },
        ),
      ).catch(() => null);

      let contactId: string;

      if (searchResponse && searchResponse.data?.total > 0) {
        contactId = searchResponse.data.results[0].id;
        this.logger.log(`Found existing HubSpot contact: ${contactId}`);
      } else {
        // Create contact
        const names = name?.split(' ') || ['Unknown'];
        const firstName = names[0];
        const lastName = names.length > 1 ? names.slice(1).join(' ') : 'User';

        const createResponse = await firstValueFrom(
          this.httpService.post(
            `${this.baseUrl}/objects/contacts`,
            {
              properties: {
                email,
                firstname: firstName,
                lastname: lastName,
                phone: phone || '',
              },
            },
            { headers: this.headers },
          ),
        );
        contactId = createResponse.data.id;
        this.logger.log(`Created new HubSpot contact: ${contactId}`);
      }

      return contactId;
    } catch (error) {
      this.logger.error(`Error in createOrUpdateContact: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Create a call engagement (note) and associate it with a contact.
   */
  async createCallEngagement(contactId: string, data: { summary: string; transcript: string; recordingUrl?: string }) {
    try {
      this.logger.log(`Creating HubSpot call engagement for contact ${contactId}`);

      // We use the "Notes" object for call logs as it's the most flexible in the free tier
      // and allows associating with contacts easily.
      const noteBody = `
        <h3>Voice Call Summary</h3>
        <p>${data.summary.replace(/\n/g, '<br>')}</p>
        ${data.recordingUrl ? `<p><strong>Recording:</strong> <a href="${data.recordingUrl}">${data.recordingUrl}</a></p>` : ''}
        <details>
          <summary>Full Transcript</summary>
          <p>${data.transcript.replace(/\n/g, '<br>')}</p>
        </details>
      `.trim();

      const createNoteResponse = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/objects/notes`,
          {
            properties: {
              hs_note_body: noteBody,
              hs_timestamp: new Date().toISOString(),
            },
            associations: [
              {
                to: { id: contactId },
                types: [
                  {
                    associationCategory: 'HUBSPOT_DEFINED',
                    associationTypeId: 202, // Note to Contact
                  },
                ],
              },
            ],
          },
          { headers: this.headers },
        ),
      );

      this.logger.log(`HubSpot note created: ${createNoteResponse.data.id}`);
      return createNoteResponse.data.id;
    } catch (error) {
      this.logger.error(`Error in createCallEngagement: ${error.message}`, error.stack);
      return null;
    }
  }
}
