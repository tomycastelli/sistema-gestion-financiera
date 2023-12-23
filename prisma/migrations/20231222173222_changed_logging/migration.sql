-- DropForeignKey
ALTER TABLE "Logs" DROP CONSTRAINT "Logs_userId_fkey";

-- AlterTable
ALTER TABLE "Logs" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
