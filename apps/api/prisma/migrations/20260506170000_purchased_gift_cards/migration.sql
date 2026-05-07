CREATE TABLE "PurchasedGiftCard" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "retailerName" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "codeLast4" TEXT NOT NULL,
  "encryptedCode" TEXT NOT NULL,
  "encryptedPin" TEXT,
  "brokerProvider" TEXT NOT NULL,
  "brokerReference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expiresAt" TIMESTAMP(3),
  "fraudRisk" TEXT NOT NULL DEFAULT 'unknown',
  "buyerProtection" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchasedGiftCard_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PurchasedGiftCard"
  ADD CONSTRAINT "PurchasedGiftCard_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PurchasedGiftCard_userId_createdAt_idx"
  ON "PurchasedGiftCard"("userId", "createdAt");

CREATE INDEX "PurchasedGiftCard_retailerName_idx"
  ON "PurchasedGiftCard"("retailerName");

CREATE INDEX "PurchasedGiftCard_status_idx"
  ON "PurchasedGiftCard"("status");

CREATE INDEX "PurchasedGiftCard_expiresAt_idx"
  ON "PurchasedGiftCard"("expiresAt");
