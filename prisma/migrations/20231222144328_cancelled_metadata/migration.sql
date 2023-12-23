-- DropIndex
DROP INDEX "Balances_selectedEntityId_otherEntityId_idx";

-- AlterTable
ALTER TABLE "TransactionsMetadata" ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "cancelledDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Balances_selectedEntityId_otherEntityId_date_idx" ON "Balances"("selectedEntityId", "otherEntityId", "date");

-- AddForeignKey
ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
