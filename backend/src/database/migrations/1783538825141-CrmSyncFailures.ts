import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrmSyncFailures1783538825141 implements MigrationInterface {
  name = 'CrmSyncFailures1783538825141';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."crm_sync_failures_type_enum" AS ENUM('CONTACT_SYNC', 'CALL_ENGAGEMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."crm_sync_failures_status_enum" AS ENUM('PENDING', 'RESOLVED', 'FAILED')`,
    );

    await queryRunner.query(
      `CREATE TABLE "crm_sync_failures" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."crm_sync_failures_type_enum" NOT NULL, "payload" jsonb NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "lastError" text, "status" "public"."crm_sync_failures_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_crm_sync_failures_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "crm_sync_failures"`);
    await queryRunner.query(
      `DROP TYPE "public"."crm_sync_failures_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."crm_sync_failures_type_enum"`);
  }
}
