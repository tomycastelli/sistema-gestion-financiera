-- DropIndex
DROP INDEX "Movements_transactionId_idx";

-- DropIndex
DROP INDEX "Transactions_operationId_fromEntityId_toEntityId_idx";

-- CreateIndex
CREATE INDEX "Movements_transactionId_direction_idx" ON "Movements"("transactionId", "direction");

-- CreateIndex
CREATE INDEX "Transactions_operationId_fromEntityId_toEntityId_date_curre_idx" ON "Transactions"("operationId", "fromEntityId", "toEntityId", "date", "currency");
