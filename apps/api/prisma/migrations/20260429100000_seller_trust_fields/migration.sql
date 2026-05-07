ALTER TABLE "RetailerProduct"
  ADD COLUMN "sellerName" TEXT,
  ADD COLUMN "isAuthorizedSeller" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "returnWindowDays" INTEGER,
  ADD COLUMN "warrantySupport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customerRating" DOUBLE PRECISION,
  ADD COLUMN "counterfeitRisk" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX "RetailerProduct_isAuthorizedSeller_idx" ON "RetailerProduct"("isAuthorizedSeller");
CREATE INDEX "RetailerProduct_counterfeitRisk_idx" ON "RetailerProduct"("counterfeitRisk");
