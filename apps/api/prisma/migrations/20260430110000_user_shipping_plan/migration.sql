CREATE TABLE "UserShippingPlan" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "cartId"     TEXT,
  "planName"   TEXT NOT NULL,
  "planData"   JSONB NOT NULL,
  "totalCost"  DOUBLE PRECISION NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserShippingPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserShippingPlan_userId_createdAt_idx" ON "UserShippingPlan"("userId", "createdAt");

ALTER TABLE "UserShippingPlan"
  ADD CONSTRAINT "UserShippingPlan_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
