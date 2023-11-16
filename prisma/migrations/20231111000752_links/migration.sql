/*
  Warnings:

  - You are about to drop the column `data` on the `Links` table. All the data in the column will be lost.
  - Added the required column `sharedEntityId` to the `Links` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Links" DROP COLUMN "data",
ADD COLUMN     "sharedEntityId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Links" ADD CONSTRAINT "Links_sharedEntityId_fkey" FOREIGN KEY ("sharedEntityId") REFERENCES "Entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
