-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Entities_name_idx" ON "Entities"("name");

-- CreateIndex
CREATE INDEX "Entities_tag_idx" ON "Entities"("tag");

-- CreateIndex
CREATE INDEX "Movements_transactionId_idx" ON "Movements"("transactionId");

-- CreateIndex
CREATE INDEX "Operations_date_idx" ON "Operations"("date");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Transactions_operationId_idx" ON "Transactions"("operationId");

-- CreateIndex
CREATE INDEX "Transactions_fromEntityId_idx" ON "Transactions"("fromEntityId");

-- CreateIndex
CREATE INDEX "Transactions_toEntityId_idx" ON "Transactions"("toEntityId");

-- CreateIndex
CREATE INDEX "TransactionsMetadata_transactionId_idx" ON "TransactionsMetadata"("transactionId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
