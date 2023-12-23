/*
  Warnings:

  - Added the required column `currency` to the `Balances` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Balances" ADD COLUMN     "currency" TEXT NOT NULL;
