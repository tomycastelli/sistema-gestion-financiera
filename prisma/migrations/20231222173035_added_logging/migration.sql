/*
  Warnings:

  - You are about to drop the `EmailWhitelist` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "User_email_idx";

-- DropTable
DROP TABLE "EmailWhitelist";

-- CreateTable
CREATE TABLE "Logs" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "response" JSONB NOT NULL,

    CONSTRAINT "Logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_email_name_idx" ON "User"("email", "name");

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
