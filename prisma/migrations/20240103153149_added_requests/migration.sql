-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'working', 'finished');

-- CreateTable
CREATE TABLE "Requests" (
    "id" SERIAL NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "Requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Requests" ADD CONSTRAINT "Requests_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
