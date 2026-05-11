import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1778508889069 implements MigrationInterface {
    name = 'InitialSchema1778508889069'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enums
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('SUPER_ADMIN', 'ADMIN')`);
        await queryRunner.query(`CREATE TYPE "public"."messages_role_enum" AS ENUM('user', 'bot', 'agent')`);

        // Users
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'ADMIN', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672df88af371d30f51abc7e2b" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);

        // Bots
        await queryRunner.query(`CREATE TABLE "bots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "displayName" character varying NOT NULL DEFAULT 'AI Assistant', "themeColor" character varying NOT NULL DEFAULT '#6366f1', "welcomeMessage" character varying NOT NULL DEFAULT '👋 Hi there! How can I help you today?', "pricePer1kTokens" numeric(10,4) NOT NULL DEFAULT '0', "pricePerMessage" numeric(10,4) NOT NULL DEFAULT '0', "apiKey" character varying NOT NULL, "isHumanActive" boolean NOT NULL DEFAULT false, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a663953f47c32890699479b76db" UNIQUE ("apiKey"), CONSTRAINT "PK_43354ff31238914b14d59a224a1" PRIMARY KEY ("id"))`);

        // Knowledge
        await queryRunner.query(`CREATE TABLE "knowledge" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "botId" uuid NOT NULL, "embedding" double precision array, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_85bcf565ec8f673f8fb2c3a5026" PRIMARY KEY ("id"))`);

        // Conversations
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sessionId" character varying NOT NULL, "botId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_434771f845eaed03a088927ae2e" PRIMARY KEY ("id"))`);

        // Messages
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "public"."messages_role_enum" NOT NULL, "content" text NOT NULL, "conversationId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18329f3833d14af11124696495b" PRIMARY KEY ("id"))`);

        // Usage
        await queryRunner.query(`CREATE TABLE "usage" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "botId" uuid NOT NULL, "month" character varying NOT NULL, "messageCount" integer NOT NULL DEFAULT '0', "tokenCount" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_55486c4f03943644f80879612c7" UNIQUE ("botId", "month"), CONSTRAINT "PK_554c2a5503b47318f73f71c6dd6" PRIMARY KEY ("id"))`);

        // Foreign Keys
        await queryRunner.query(`ALTER TABLE "bots" ADD CONSTRAINT "FK_2862d2b591b98818c7ea3b7194e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "knowledge" ADD CONSTRAINT "FK_19554bf03a943644f80879612c7" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_44486c4f03943644f80879612c7" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_55486c4f03943644f80879612c7" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "usage" ADD CONSTRAINT "FK_66486c4f03943644f80879612c7" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usage" DROP CONSTRAINT "FK_66486c4f03943644f80879612c7"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_55486c4f03943644f80879612c7"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_44486c4f03943644f80879612c7"`);
        await queryRunner.query(`ALTER TABLE "knowledge" DROP CONSTRAINT "FK_19554bf03a943644f80879612c7"`);
        await queryRunner.query(`ALTER TABLE "bots" DROP CONSTRAINT "FK_2862d2b591b98818c7ea3b7194e"`);
        
        await queryRunner.query(`DROP TABLE "usage"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP TABLE "knowledge"`);
        await queryRunner.query(`DROP TABLE "bots"`);
        await queryRunner.query(`DROP TABLE "users"`);
        
        await queryRunner.query(`DROP TYPE "public"."messages_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
