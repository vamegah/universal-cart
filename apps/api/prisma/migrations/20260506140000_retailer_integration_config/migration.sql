CREATE TABLE "RetailerIntegrationConfig" (
    "id" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "pricingRefreshCadence" TEXT NOT NULL DEFAULT 'manual_or_import_triggered',
    "catalogIngestionStatus" TEXT NOT NULL DEFAULT 'manual',
    "affiliateMode" TEXT NOT NULL DEFAULT 'not_configured',
    "affiliateId" TEXT,
    "partnershipStatus" TEXT NOT NULL DEFAULT 'unverified',
    "partnerContactEmail" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailerIntegrationConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetailerIntegrationConfig_retailerName_key" ON "RetailerIntegrationConfig"("retailerName");
CREATE INDEX "RetailerIntegrationConfig_partnershipStatus_idx" ON "RetailerIntegrationConfig"("partnershipStatus");
