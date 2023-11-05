/*
  Warnings:

  - You are about to drop the column `type` on the `TransactionsMetadata` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[transactionId]` on the table `TransactionsMetadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id]` on the table `TransactionsMetadata` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TransactionsMetadata" DROP COLUMN "type";

-- CreateIndex
CREATE UNIQUE INDEX "TransactionsMetadata_transactionId_key" ON "TransactionsMetadata"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionsMetadata_id_key" ON "TransactionsMetadata"("id");
