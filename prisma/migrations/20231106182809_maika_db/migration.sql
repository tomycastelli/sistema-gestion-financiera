-- AlterTable
ALTER TABLE "TransactionsMetadata" ADD COLUMN     "confirmedDate" TIMESTAMP(3),
ADD COLUMN     "uploadedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
