ALTER TABLE "VirtualCardTransaction"
  ADD CONSTRAINT "VirtualCardTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SettlementLedgerEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cartId" TEXT,
  "virtualCardTransactionId" TEXT,
  "retailerName" TEXT,
  "entryType" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SettlementLedgerEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SettlementLedgerEntry"
  ADD CONSTRAINT "SettlementLedgerEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SettlementLedgerEntry"
  ADD CONSTRAINT "SettlementLedgerEntry_virtualCardTransactionId_fkey"
  FOREIGN KEY ("virtualCardTransactionId") REFERENCES "VirtualCardTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SettlementLedgerEntry_userId_createdAt_idx"
  ON "SettlementLedgerEntry"("userId", "createdAt");

CREATE INDEX "SettlementLedgerEntry_cartId_idx"
  ON "SettlementLedgerEntry"("cartId");

CREATE INDEX "SettlementLedgerEntry_virtualCardTransactionId_idx"
  ON "SettlementLedgerEntry"("virtualCardTransactionId");

CREATE INDEX "SettlementLedgerEntry_entryType_status_idx"
  ON "SettlementLedgerEntry"("entryType", "status");
