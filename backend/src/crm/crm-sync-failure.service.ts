import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CrmSyncFailure,
  CrmSyncStatus,
  CrmSyncType,
} from './entities/crm-sync-failure.entity';
import { HubSpotService } from './hubspot.service';
import { BotService } from '../bot/bot.service';
import { UserRole } from '../auth/entities/user.entity';

const MAX_ATTEMPTS = 5;

export interface RequestingUser {
  id: string;
  role: UserRole;
}

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

  /** Scoped to the requesting user's own bots — SUPER_ADMIN sees every tenant's failures. */
  async findAll(
    requestingUser: RequestingUser,
    status?: CrmSyncStatus,
    page = 1,
    limit = 20,
  ): Promise<{
    data: CrmSyncFailure[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where: { status?: CrmSyncStatus; botId?: ReturnType<typeof In> } = status ? { status } : {};

    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      const botIds = await this.botService.findOwnedBotIds(requestingUser.id);
      if (botIds.length === 0) {
        return { data: [], total: 0, page, limit };
      }
      where.botId = In(botIds);
    }

    const [data, total] = await this.failureRepo.findAndCount({
      where,
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
  async retryOne(id: string, requestingUser: RequestingUser): Promise<CrmSyncFailure> {
    const failure = await this.failureRepo.findOne({ where: { id } });
    if (!failure) {
      throw new NotFoundException('Sync failure not found');
    }
    if (requestingUser.role !== UserRole.SUPER_ADMIN) {
      // Throws NotFoundException/ForbiddenException if this bot isn't the requester's.
      await this.botService.findOne(failure.botId, requestingUser.id);
    }
    return this.attemptRetry(failure);
  }

  /** Sweeps pending dead-letters on a schedule so failures self-heal without manual action. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryPending(): Promise<void> {
    const pending = await this.failureRepo.find({
      where: { status: CrmSyncStatus.PENDING },
      take: 50,
    });
    for (const failure of pending) {
      await this.attemptRetry(failure).catch((error) =>
        this.logger.error(
          `Retry sweep failed for ${failure.id}: ${error.message}`,
        ),
      );
    }
  }

  private async attemptRetry(failure: CrmSyncFailure): Promise<CrmSyncFailure> {
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
