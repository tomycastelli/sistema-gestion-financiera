CREATE TABLE IF NOT EXISTS "oauth_account" (
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "oauth_account_provider_provider_id_pk" PRIMARY KEY("provider","provider_id")
);
--> statement-breakpoint
ALTER TABLE "User" RENAME COLUMN "image" TO "photo_url";--> statement-breakpoint
ALTER TABLE "Session" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "Session" RENAME COLUMN "expires" TO "expires_at";--> statement-breakpoint
ALTER TABLE "TransactionsMetadata" DROP CONSTRAINT "TransactionsMetadata_transactionId_fkey";
--> statement-breakpoint
ALTER TABLE "TransactionsMetadata" DROP CONSTRAINT "TransactionsMetadata_uploadedBy_fkey";
--> statement-breakpoint
ALTER TABLE "TransactionsMetadata" DROP CONSTRAINT "TransactionsMetadata_confirmedBy_fkey";
--> statement-breakpoint
ALTER TABLE "TransactionsMetadata" DROP CONSTRAINT "TransactionsMetadata_cancelledBy_fkey";
--> statement-breakpoint
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_operationId_fkey";
--> statement-breakpoint
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_operatorEntityId_fkey";
--> statement-breakpoint
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_fromEntityId_fkey";
--> statement-breakpoint
ALTER TABLE "Transactions" DROP CONSTRAINT "Transactions_toEntityId_fkey";
--> statement-breakpoint
ALTER TABLE "Links" DROP CONSTRAINT "Links_sharedEntityId_fkey";
--> statement-breakpoint
ALTER TABLE "Balances" DROP CONSTRAINT "Balances_selectedEntityId_fkey";
--> statement-breakpoint
ALTER TABLE "Balances" DROP CONSTRAINT "Balances_otherEntityId_fkey";
--> statement-breakpoint
ALTER TABLE "Entities" DROP CONSTRAINT "Entities_tagName_fkey";
--> statement-breakpoint
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";
--> statement-breakpoint
ALTER TABLE "User" DROP CONSTRAINT "User_entityId_fkey";
--> statement-breakpoint
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_parent_fkey";
--> statement-breakpoint
ALTER TABLE "Account" DROP CONSTRAINT "Account_userId_fkey";
--> statement-breakpoint
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";
--> statement-breakpoint
ALTER TABLE "Movements" DROP CONSTRAINT "Movements_transactionId_fkey";
--> statement-breakpoint
ALTER TABLE "Movements" DROP CONSTRAINT "Movements_balanceId_fkey";
--> statement-breakpoint
ALTER TABLE "Requests" DROP CONSTRAINT "Requests_uploadedBy_fkey";
--> statement-breakpoint
DROP INDEX IF EXISTS "Session_sessionToken_key";--> statement-breakpoint
DROP INDEX IF EXISTS "Session_userId_sessionToken_idx";--> statement-breakpoint
ALTER TABLE "TransactionsMetadata" ALTER COLUMN "uploadedDate" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "TransactionsMetadata" ALTER COLUMN "uploadedDate" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "Operations" ALTER COLUMN "date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "Transactions" ALTER COLUMN "date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "Balances" ALTER COLUMN "date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "Session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_transactionId_Transactions_id_fk" FOREIGN KEY ("transactionId") REFERENCES "Transactions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_uploadedBy_User_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_confirmedBy_User_id_fk" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_cancelledBy_User_id_fk" FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_operationId_Operations_id_fk" FOREIGN KEY ("operationId") REFERENCES "Operations"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_operatorEntityId_Entities_id_fk" FOREIGN KEY ("operatorEntityId") REFERENCES "Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fromEntityId_Entities_id_fk" FOREIGN KEY ("fromEntityId") REFERENCES "Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_toEntityId_Entities_id_fk" FOREIGN KEY ("toEntityId") REFERENCES "Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Links" ADD CONSTRAINT "Links_sharedEntityId_Entities_id_fk" FOREIGN KEY ("sharedEntityId") REFERENCES "Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Balances" ADD CONSTRAINT "Balances_otherEntityId_Entities_id_fk" FOREIGN KEY ("otherEntityId") REFERENCES "Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Balances" ADD CONSTRAINT "Balances_selectedEntityId_Entities_id_fk" FOREIGN KEY ("selectedEntityId") REFERENCES "Entities"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Entities" ADD CONSTRAINT "Entities_tagName_Tag_name_fk" FOREIGN KEY ("tagName") REFERENCES "Tag"("name") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_roleId_Role_id_fk" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_entityId_Entities_id_fk" FOREIGN KEY ("entityId") REFERENCES "Entities"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Tag" ADD CONSTRAINT "Tag_parent_fkey" FOREIGN KEY ("parent") REFERENCES "Tag"("name") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Movements" ADD CONSTRAINT "Movements_transactionId_Transactions_id_fk" FOREIGN KEY ("transactionId") REFERENCES "Transactions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Movements" ADD CONSTRAINT "Movements_balanceId_Balances_id_fk" FOREIGN KEY ("balanceId") REFERENCES "Balances"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Requests" ADD CONSTRAINT "Requests_uploadedBy_User_id_fk" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE restrict ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";--> statement-breakpoint
ALTER TABLE "Session" DROP COLUMN IF EXISTS "sessionToken";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
