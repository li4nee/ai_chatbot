import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiProviderByok1783541948609 implements MigrationInterface {
    name = 'MultiProviderByok1783541948609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."bots_aiprovider_enum" AS ENUM('GEMINI', 'OPENAI', 'ANTHROPIC', 'GROQ', 'MISTRAL')`);

        // Ciphertext doesn't care what the column is called — renaming preserves any already-encrypted value.
        await queryRunner.query(`ALTER TABLE "bots" RENAME COLUMN "geminiApiKeyEncrypted" TO "aiApiKeyEncrypted"`);

        await queryRunner.query(`ALTER TABLE "bots" ADD "aiProvider" "public"."bots_aiprovider_enum" NOT NULL DEFAULT 'GEMINI'`);
        await queryRunner.query(`ALTER TABLE "bots" ADD "embeddingProvider" "public"."bots_aiprovider_enum"`);
        await queryRunner.query(`ALTER TABLE "bots" ADD "embeddingApiKeyEncrypted" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "embeddingApiKeyEncrypted"`);
        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "embeddingProvider"`);
        await queryRunner.query(`ALTER TABLE "bots" DROP COLUMN "aiProvider"`);
        await queryRunner.query(`ALTER TABLE "bots" RENAME COLUMN "aiApiKeyEncrypted" TO "geminiApiKeyEncrypted"`);
        await queryRunner.query(`DROP TYPE "public"."bots_aiprovider_enum"`);
    }

}
