-- AlterTable
ALTER TABLE "User" ALTER COLUMN "permissions" DROP NOT NULL,
ALTER COLUMN "permissions" DROP DEFAULT;
