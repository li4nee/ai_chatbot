import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CrmSyncType {
  CONTACT_SYNC = 'CONTACT_SYNC',
  CALL_ENGAGEMENT = 'CALL_ENGAGEMENT',
}

export enum CrmSyncStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  FAILED = 'FAILED',
}

/**
 * Dead-letter record for a HubSpot sync that failed after retries.
 * `payload` holds whatever CrmSyncFailureService needs to replay the sync:
 * - CONTACT_SYNC: { email, name?, phone? }
 * - CALL_ENGAGEMENT: { contactId, summary, transcript, recordingUrl? }
 */
@Entity('crm_sync_failures')
export class CrmSyncFailure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  botId: string;

  @Column({ type: 'enum', enum: CrmSyncType })
  type: CrmSyncType;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column({ default: 0 })
  attempts: number;

  @Column('text', { nullable: true })
  lastError: string | null;

  @Column({ type: 'enum', enum: CrmSyncStatus, default: CrmSyncStatus.PENDING })
  status: CrmSyncStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
