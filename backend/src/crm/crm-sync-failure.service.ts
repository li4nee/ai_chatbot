import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CrmSyncFailure,
  CrmSyncStatus,
  CrmSyncType,
} from './entities/crm-sync-failure.entity';
import { HubSpotService } from './hubspot.service';
import { BotService } from '../bot/bot.service';

const MAX_ATTEMPTS = 5;

@Injectable()
export class CrmSyncFailureService {
  private readonly logger = new Logger(CrmSyncFailureService.name);

  constructor(
    @InjectRepository(CrmSyncFailure)
    private failureRepo: Repository<CrmSyncFailure>,
    private hubSpotService: HubSpotService,
    private botService: BotService,
  ) {}

  /** Dead-letter a sync that failed after HubSpotService's own retries were exhausted. */
  async record(
    botId: string,
    type: CrmSyncType,
    payload: Record<string, any>,
    error?: string,
  ): Promise<CrmSyncFailure> {
    const failure = this.failureRepo.create({
      botId,
      type,
      payload,
      lastError: error ?? null,
    });
    const saved = await this.failureRepo.save(failure);
    this.logger.warn(`Recorded CRM sync failure [${type}]: ${saved.id}`);
    return saved;
  }

  async findAll(
    status?: CrmSyncStatus,
    page = 1,
    limit = 20,
  ): Promise<{
    data: CrmSyncFailure[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [data, total] = await this.failureRepo.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  /**
   * Replays the sync represented by a dead-letter row. Idempotent: HubSpot contact
   * lookups are by email, so re-running a CONTACT_SYNC that already partially
   * succeeded just finds the existing contact rather than duplicating it.
   */
  async retryOne(id: string): Promise<CrmSyncFailure> {
    const failure = await this.failureRepo.findOne({ where: { id } });
    if (!failure) {
      throw new NotFoundException('Sync failure not found');
    }
    if (failure.status === CrmSyncStatus.RESOLVED) {
      return failure;
    }

    try {
      await this.performSync(failure);
      failure.status = CrmSyncStatus.RESOLVED;
      failure.lastError = null;
    } catch (error) {
      failure.attempts += 1;
      failure.lastError = error.message;
      failure.status =
        failure.attempts >= MAX_ATTEMPTS
          ? CrmSyncStatus.FAILED
          : CrmSyncStatus.PENDING;
    }
    return this.failureRepo.save(failure);
  }

  /** Sweeps pending dead-letters on a schedule so failures self-heal without manual action. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryPending(): Promise<void> {
    const pending = await this.failureRepo.find({
      where: { status: CrmSyncStatus.PENDING },
      take: 50,
    });
    for (const failure of pending) {
      await this.retryOne(failure.id).catch((error) =>
        this.logger.error(
          `Retry sweep failed for ${failure.id}: ${error.message}`,
        ),
      );
    }
  }

  private async performSync(failure: CrmSyncFailure): Promise<void> {
    const { hubspotAccessToken } = await this.botService.getIntegrationCredentials(failure.botId);
    if (!hubspotAccessToken) {
      throw new Error('Bot no longer has a HubSpot access token configured');
    }

    if (failure.type === CrmSyncType.CONTACT_SYNC) {
      const { email, name, phone, summary, transcript, recordingUrl } =
        failure.payload;
      const contactId = await this.hubSpotService.createOrUpdateContact(
        { email, name, phone },
        hubspotAccessToken,
      );
      if (!contactId) {
        throw new Error('HubSpot contact sync failed');
      }
      if (summary && transcript) {
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
          throw new Error('Contact synced but call engagement note failed');
        }
      }
    } else {
      const { contactId, summary, transcript, recordingUrl } = failure.payload;
      const noteId = await this.hubSpotService.createCallEngagement(
        contactId,
        { summary, transcript, recordingUrl },
        hubspotAccessToken,
      );
      if (!noteId) {
        throw new Error('HubSpot call engagement failed');
      }
    }
  }
}
