-- CreateTable
CREATE TABLE "Links" (
    "id" SERIAL NOT NULL,
    "data" JSONB NOT NULL,
    "password" TEXT NOT NULL,
    "expiration" TIMESTAMP(3),

    CONSTRAINT "Links_pkey" PRIMARY KEY ("id")
);
