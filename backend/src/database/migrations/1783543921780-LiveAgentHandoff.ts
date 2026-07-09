import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveAgentHandoff1783543921780 implements MigrationInterface {
    name = 'LiveAgentHandoff1783543921780'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bots" RENAME COLUMN "isHumanActive" TO "humanHandoffEnabled"`);

        await queryRunner.query(`CREATE TYPE "public"."conversations_status_enum" AS ENUM('BOT', 'NEEDS_HUMAN', 'HUMAN')`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'BOT'`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "assignedAdminId" uuid`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_conversations_assignedAdminId" FOREIGN KEY ("assignedAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_conversations_assignedAdminId"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "assignedAdminId"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);

        await queryRunner.query(`ALTER TABLE "bots" RENAME COLUMN "humanHandoffEnabled" TO "isHumanActive"`);
    }

}
