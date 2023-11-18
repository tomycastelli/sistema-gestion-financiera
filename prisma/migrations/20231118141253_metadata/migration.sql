/*
  Warnings:

  - You are about to drop the column `additional` on the `TransactionsMetadata` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TransactionsMetadata" DROP COLUMN "additional",
ADD COLUMN     "metadata" JSONB;
