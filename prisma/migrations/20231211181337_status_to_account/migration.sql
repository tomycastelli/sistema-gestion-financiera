/*
  Warnings:

  - You are about to drop the column `status` on the `Movements` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Movements" DROP COLUMN "status",
ADD COLUMN     "account" BOOLEAN NOT NULL DEFAULT false;
