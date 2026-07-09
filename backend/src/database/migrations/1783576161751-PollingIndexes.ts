import { MigrationInterface, QueryRunner } from 'typeorm';

export class PollingIndexes1783576161751 implements MigrationInterface {
    name = 'PollingIndexes1783576161751'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_conversations_botId_sessionId" ON "conversations" ("botId", "sessionId")`);
        await queryRunner.query(`CREATE INDEX "IDX_messages_conversationId_createdAt" ON "messages" ("conversationId", "createdAt")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_messages_conversationId_createdAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_conversations_botId_sessionId"`);
    }

}
