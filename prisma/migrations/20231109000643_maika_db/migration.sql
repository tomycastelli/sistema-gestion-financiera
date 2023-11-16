/*
  Warnings:

  - You are about to drop the column `observations` on the `Movements` table. All the data in the column will be lost.
  - The primary key for the `TransactionsMetadata` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `TransactionsMetadata` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Session_userId_idx";

-- DropIndex
DROP INDEX "Transactions_fromEntityId_idx";

-- DropIndex
DROP INDEX "Transactions_operationId_idx";

-- DropIndex
DROP INDEX "Transactions_toEntityId_idx";

-- DropIndex
DROP INDEX "TransactionsMetadata_id_key";

-- AlterTable
ALTER TABLE "Movements" DROP COLUMN "observations",
ADD COLUMN     "status" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TransactionsMetadata" DROP CONSTRAINT "TransactionsMetadata_pkey",
DROP COLUMN "id";

-- CreateIndex
CREATE INDEX "Session_userId_sessionToken_idx" ON "Session"("userId", "sessionToken");

-- CreateIndex
CREATE INDEX "Transactions_operationId_fromEntityId_toEntityId_idx" ON "Transactions"("operationId", "fromEntityId", "toEntityId");
