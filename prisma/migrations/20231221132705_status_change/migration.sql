/*
  Warnings:

  - You are about to drop the column `status` on the `Operations` table. All the data in the column will be lost.
  - The `status` column on the `Transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Status" AS ENUM ('pending', 'confirmed', 'cancelled');

-- AlterTable
ALTER TABLE "Operations" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Transactions" DROP COLUMN "status",
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'pending';
