/*
  Warnings:

  - Added the required column `balance` to the `Movements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Movements" ADD COLUMN     "balance" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "Balances" (
    "id" SERIAL NOT NULL,
    "fromEntityId" INTEGER NOT NULL,
    "toEntityId" INTEGER NOT NULL,
    "account" BOOLEAN NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Balances_fromEntityId_toEntityId_idx" ON "Balances"("fromEntityId", "toEntityId");

-- AddForeignKey
ALTER TABLE "Balances" ADD CONSTRAINT "Balances_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Balances" ADD CONSTRAINT "Balances_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
