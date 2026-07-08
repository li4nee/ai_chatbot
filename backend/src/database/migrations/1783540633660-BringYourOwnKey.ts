import { MigrationInterface, QueryRunner } from 'typeorm';

export class BringYourOwnKey1783540633660 implements MigrationInterface {
    name = 'BringYourOwnKey1783540633660'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bots" ADD "geminiApiKeyEncrypted" text`);
        await queryRunner.query(`ALTER TABLE "bots" ADD "hubspotAccessTokenEncrypted" text`);
        await queryRunner.query(`ALTER TABLE "bots" ADD "vapiWebhookSecretEncrypted" text`);
        await queryRunner.query(`ALTER TABLE "bots" ADD "vapiPublicKey" text`);
        await queryRunner.query(`ALTER TABLE "bots" ADD "vapiAssistantId" text`);

        // crm_sync_failures was added without a bot association — BYOK retries need
        // to know whose HubSpot token to replay with. Table is new/empty, so NOT NULL directly.
        await queryRunner.query(`ALTER TABLE "crm_sync_failures" ADD "botId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "crm_sync_failures" ADD CONSTRAINT "FK_crm_sync_failures_botId" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "crm_sync_failures" DROP CONSTRAINT "FK_crm_sync_failures_botId"`);
        await queryRunner.query(`ALTER TABLE "crm_sync_failures" DROP COLUMN "botId"`);

        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "vapiAssistantId"`);
        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "vapiPublicKey"`);
        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "vapiWebhookSecretEncrypted"`);
        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "hubspotAccessTokenEncrypted"`);
        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "geminiApiKeyEncrypted"`);
    }

}
