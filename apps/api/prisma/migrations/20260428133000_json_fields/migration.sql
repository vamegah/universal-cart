-- Convert JSON-shaped text columns to native PostgreSQL jsonb columns.
ALTER TABLE "UserPreferences"
  ALTER COLUMN "shippingPref" TYPE JSONB
  USING CASE
    WHEN "shippingPref" IS NULL THEN NULL
    ELSE "shippingPref"::jsonb
  END;

ALTER TABLE "UserCard"
  ALTER COLUMN "financingTerms" TYPE JSONB
  USING CASE
    WHEN "financingTerms" IS NULL THEN NULL
    ELSE "financingTerms"::jsonb
  END;

ALTER TABLE "Product"
  ALTER COLUMN "attributes" TYPE JSONB
  USING CASE
    WHEN "attributes" IS NULL THEN NULL
    ELSE "attributes"::jsonb
  END,
  ALTER COLUMN "rawMetadata" TYPE JSONB
  USING CASE
    WHEN "rawMetadata" IS NULL THEN NULL
    ELSE "rawMetadata"::jsonb
  END;

ALTER TABLE "SplitPlan"
  ALTER COLUMN "assignment" TYPE JSONB
  USING "assignment"::jsonb;

ALTER TABLE "AutoBuyRule"
  ALTER COLUMN "trigger" TYPE JSONB
  USING "trigger"::jsonb;
