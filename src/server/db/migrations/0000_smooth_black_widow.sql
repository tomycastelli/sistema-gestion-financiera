-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
DO $$ BEGIN
 CREATE TYPE "Status" AS ENUM('cancelled', 'confirmed', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "RequestStatus" AS ENUM('finished', 'working', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TransactionsMetadata" (
	"transactionId" integer NOT NULL,
	"uploadedBy" text NOT NULL,
	"uploadedDate" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"confirmedBy" text,
	"confirmedDate" timestamp(3),
	"history" jsonb,
	"metadata" jsonb,
	"cancelledBy" text,
	"cancelledDate" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp(3) NOT NULL,
	"observations" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"operationId" integer NOT NULL,
	"type" text NOT NULL,
	"date" timestamp(3),
	"operatorEntityId" integer NOT NULL,
	"fromEntityId" integer NOT NULL,
	"toEntityId" integer NOT NULL,
	"currency" text NOT NULL,
	"amount" double precision NOT NULL,
	"method" text,
	"observations" text,
	"status" "Status" DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Links" (
	"id" serial PRIMARY KEY NOT NULL,
	"sharedEntityId" integer NOT NULL,
	"password" text NOT NULL,
	"expiration" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Balances" (
	"id" serial PRIMARY KEY NOT NULL,
	"account" boolean NOT NULL,
	"date" timestamp(3) NOT NULL,
	"balance" double precision NOT NULL,
	"otherEntityId" integer NOT NULL,
	"selectedEntityId" integer NOT NULL,
	"currency" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagName" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp(3),
	"image" text,
	"permissions" jsonb,
	"roleId" integer,
	"entityId" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Role" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"color" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Tag" (
	"name" text PRIMARY KEY NOT NULL,
	"parent" text,
	"color" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	"expires_in" integer,
	"ext_expires_in" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"transactionId" integer NOT NULL,
	"direction" integer NOT NULL,
	"type" text NOT NULL,
	"account" boolean DEFAULT false NOT NULL,
	"balance" double precision NOT NULL,
	"balanceId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"uploadedBy" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" "RequestStatus" DEFAULT 'pending' NOT NULL,
	"developerMessage" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "TransactionsMetadata_transactionId_key" ON "TransactionsMetadata" ("transactionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TransactionsMetadata_transactionId_uploadedBy_confirmedBy_idx" ON "TransactionsMetadata" ("transactionId","uploadedBy","confirmedBy");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken" ("token");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken" ("identifier","token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Operations_date_idx" ON "Operations" ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Transactions_operationId_fromEntityId_toEntityId_date_curre_idx" ON "Transactions" ("operationId","date","fromEntityId","toEntityId","currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Balances_selectedEntityId_otherEntityId_date_account_curren_idx" ON "Balances" ("account","date","otherEntityId","selectedEntityId","currency");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Entities_name_idx" ON "Entities" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Entities_name_key" ON "Entities" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Entities_tagName_idx" ON "Entities" ("tagName");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_name_key" ON "User" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_entityId_key" ON "User" ("entityId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_email_name_idx" ON "User" ("name","email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Role_name_idx" ON "Role" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account" ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account" ("provider","providerAccountId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session" ("sessionToken");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Session_userId_sessionToken_idx" ON "Session" ("sessionToken","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Movements_transactionId_direction_idx" ON "Movements" ("transactionId","direction");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transactions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "public"."Operations"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_operatorEntityId_fkey" FOREIGN KEY ("operatorEntityId") REFERENCES "public"."Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "public"."Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "public"."Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Links" ADD CONSTRAINT "Links_sharedEntityId_fkey" FOREIGN KEY ("sharedEntityId") REFERENCES "public"."Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Balances" ADD CONSTRAINT "Balances_selectedEntityId_fkey" FOREIGN KEY ("selectedEntityId") REFERENCES "public"."Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Balances" ADD CONSTRAINT "Balances_otherEntityId_fkey" FOREIGN KEY ("otherEntityId") REFERENCES "public"."Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Entities" ADD CONSTRAINT "Entities_tagName_fkey" FOREIGN KEY ("tagName") REFERENCES "public"."Tag"("name") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "public"."Entities"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Tag" ADD CONSTRAINT "Tag_parent_fkey" FOREIGN KEY ("parent") REFERENCES "public"."Tag"("name") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Movements" ADD CONSTRAINT "Movements_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."Transactions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Movements" ADD CONSTRAINT "Movements_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "public"."Balances"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Requests" ADD CONSTRAINT "Requests_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

*/