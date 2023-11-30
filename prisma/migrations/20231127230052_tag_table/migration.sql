/*
  Warnings:

  - You are about to drop the column `tag` on the `Entities` table. All the data in the column will be lost.
  - Added the required column `tagName` to the `Entities` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Entities_tag_idx";

-- AlterTable
ALTER TABLE "Entities" DROP COLUMN "tag",
ADD COLUMN     "tagName" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Tag" (
    "name" TEXT NOT NULL,
    "parent" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "Entities_tagName_idx" ON "Entities"("tagName");

-- AddForeignKey
ALTER TABLE "Entities" ADD CONSTRAINT "Entities_tagName_fkey" FOREIGN KEY ("tagName") REFERENCES "Tag"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
