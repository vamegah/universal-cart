-- Add historical price tracking for retailer listings.
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "retailerProductId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceHistory_retailerProductId_recordedAt_idx"
    ON "PriceHistory"("retailerProductId", "recordedAt");

ALTER TABLE "PriceHistory"
    ADD CONSTRAINT "PriceHistory_retailerProductId_fkey"
    FOREIGN KEY ("retailerProductId")
    REFERENCES "RetailerProduct"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Recurring auto-buy rules can optionally store cadence metadata separately
-- from the trigger payload.
ALTER TABLE "AutoBuyRule"
    ADD COLUMN "subscriptionCadence" JSONB;
