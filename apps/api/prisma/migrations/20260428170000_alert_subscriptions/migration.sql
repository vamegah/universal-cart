CREATE TABLE "AlertSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "alertType" TEXT NOT NULL,
  "targetPrice" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastTriggeredAt" TIMESTAMP(3),
  CONSTRAINT "AlertSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlertSubscription_userId_status_idx" ON "AlertSubscription"("userId", "status");
CREATE INDEX "AlertSubscription_productId_idx" ON "AlertSubscription"("productId");
CREATE INDEX "AlertSubscription_alertType_idx" ON "AlertSubscription"("alertType");

ALTER TABLE "AlertSubscription"
  ADD CONSTRAINT "AlertSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlertSubscription"
  ADD CONSTRAINT "AlertSubscription_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
