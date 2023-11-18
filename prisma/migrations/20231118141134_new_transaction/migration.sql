-- AlterTable
ALTER TABLE "TransactionsMetadata" ADD COLUMN     "additional" JSONB,
ALTER COLUMN "uploadedBy" DROP DEFAULT;
