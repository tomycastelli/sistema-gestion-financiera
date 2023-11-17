-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'generalValidator', 'validator');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "sucursal" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Operations" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "observations" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transactions" (
    "id" SERIAL NOT NULL,
    "operationId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "operatorEntityId" INTEGER NOT NULL,
    "fromEntityId" INTEGER NOT NULL,
    "toEntityId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT,
    "observations" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entities" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "Entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movements" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "direction" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionsMetadata" (
    "transactionId" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL DEFAULT 'clohgooer0000z1k5neo2hwcb',
    "uploadedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedBy" TEXT,
    "confirmedDate" TIMESTAMP(3),
    "history" JSONB
);

-- CreateTable
CREATE TABLE "Links" (
    "id" SERIAL NOT NULL,
    "sharedEntityId" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "expiration" TIMESTAMP(3),

    CONSTRAINT "Links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_sessionToken_idx" ON "Session"("userId", "sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Operations_date_idx" ON "Operations"("date");

-- CreateIndex
CREATE INDEX "Transactions_operationId_fromEntityId_toEntityId_date_curre_idx" ON "Transactions"("operationId", "fromEntityId", "toEntityId", "date", "currency");

-- CreateIndex
CREATE INDEX "Entities_name_idx" ON "Entities"("name");

-- CreateIndex
CREATE INDEX "Entities_tag_idx" ON "Entities"("tag");

-- CreateIndex
CREATE INDEX "Movements_transactionId_direction_idx" ON "Movements"("transactionId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionsMetadata_transactionId_key" ON "TransactionsMetadata"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionsMetadata_transactionId_uploadedBy_confirmedBy_idx" ON "TransactionsMetadata"("transactionId", "uploadedBy", "confirmedBy");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_operatorEntityId_fkey" FOREIGN KEY ("operatorEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transactions" ADD CONSTRAINT "Transactions_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movements" ADD CONSTRAINT "Movements_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionsMetadata" ADD CONSTRAINT "TransactionsMetadata_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Links" ADD CONSTRAINT "Links_sharedEntityId_fkey" FOREIGN KEY ("sharedEntityId") REFERENCES "Entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
