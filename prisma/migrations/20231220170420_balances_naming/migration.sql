/*
  Warnings:

  - You are about to drop the column `fromEntityId` on the `Balances` table. All the data in the column will be lost.
  - You are about to drop the column `toEntityId` on the `Balances` table. All the data in the column will be lost.
  - Added the required column `otherEntityId` to the `Balances` table without a default value. This is not possible if the table is not empty.
  - Added the required column `selectedEntityId` to the `Balances` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Balances" DROP CONSTRAINT "Balances_fromEntityId_fkey";

-- DropForeignKey
ALTER TABLE "Balances" DROP CONSTRAINT "Balances_toEntityId_fkey";

-- DropIndex
DROP INDEX "Balances_fromEntityId_toEntityId_idx";

-- AlterTable
ALTER TABLE "Balances" DROP COLUMN "fromEntityId",
DROP COLUMN "toEntityId",
ADD COLUMN     "otherEntityId" INTEGER NOT NULL,
ADD COLUMN     "selectedEntityId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Balances_selectedEntityId_otherEntityId_idx" ON "Balances"("selectedEntityId", "otherEntityId");

-- AddForeignKey
ALTER TABLE "Balances" ADD CONSTRAINT "Balances_selectedEntityId_fkey" FOREIGN KEY ("selectedEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balances" ADD CONSTRAINT "Balances_otherEntityId_fkey" FOREIGN KEY ("otherEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
