/*
  Warnings:

  - You are about to drop the `Logs` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Logs" DROP CONSTRAINT "Logs_userId_fkey";

-- DropIndex
DROP INDEX "Balances_selectedEntityId_otherEntityId_date_idx";

-- DropTable
DROP TABLE "Logs";

-- CreateIndex
CREATE INDEX "Balances_selectedEntityId_otherEntityId_date_account_curren_idx" ON "Balances"("selectedEntityId", "otherEntityId", "date", "account", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");
