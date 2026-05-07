ALTER TABLE "VirtualCardTransaction"
  ADD COLUMN "cardToken" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerCardId" TEXT,
  ADD COLUMN "expiry" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE INDEX "VirtualCardTransaction_providerCardId_idx"
  ON "VirtualCardTransaction"("providerCardId");
