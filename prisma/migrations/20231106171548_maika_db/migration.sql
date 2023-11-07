/*
  Warnings:

  - You are about to drop the column `metadata` on the `TransactionsMetadata` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "TransactionsMetadata_transactionId_idx";

-- AlterTable
ALTER TABLE "TransactionsMetadata" DROP COLUMN "metadata",
ADD COLUMN     "confirmedBy" TEXT,
ADD COLUMN     "history" JSONB,
ADD COLUMN     "uploadedBy" TEXT NOT NULL DEFAULT 'clohgooer0000z1k5neo2hwcb';

-- CreateIndex
CREATE INDEX "TransactionsMetadata_transactionId_uploadedBy_confirmedBy_idx" ON "TransactionsMetadata"("transactionId", "uploadedBy", "confirmedBy");

-- AddForeignKey
ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
