CREATE TABLE IF NOT EXISTS "SplitPlan" (
  "id"         TEXT NOT NULL,
  "cartId"     TEXT NOT NULL,
  "assignment" JSONB NOT NULL,
  "totalCost"  DOUBLE PRECISION NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SplitPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SplitPlan_cartId_idx" ON "SplitPlan"("cartId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'SplitPlan_cartId_fkey'
      AND conrelid = '"SplitPlan"'::regclass
  ) THEN
    ALTER TABLE "SplitPlan"
      ADD CONSTRAINT "SplitPlan_cartId_fkey"
      FOREIGN KEY ("cartId") REFERENCES "UniversalCart"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
