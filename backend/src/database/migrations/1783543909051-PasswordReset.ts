import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordReset1783543909051 implements MigrationInterface {
    name = 'PasswordReset1783543909051'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordTokenHash" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordExpiresAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordTokenHash"`);
    }

}
