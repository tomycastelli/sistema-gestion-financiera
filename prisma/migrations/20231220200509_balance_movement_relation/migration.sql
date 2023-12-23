/*
  Warnings:

  - Added the required column `balanceId` to the `Movements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Movements" ADD COLUMN     "balanceId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Movements" ADD CONSTRAINT "Movements_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "Balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
