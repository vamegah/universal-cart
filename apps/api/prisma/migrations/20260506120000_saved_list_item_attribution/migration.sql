ALTER TABLE "SavedListItem" ADD COLUMN "addedByUserId" TEXT;
ALTER TABLE "SavedListItem" ADD COLUMN "updatedByUserId" TEXT;
ALTER TABLE "SavedListItem" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "SavedListItem" ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE INDEX "SavedListItem_addedByUserId_idx" ON "SavedListItem"("addedByUserId");
CREATE INDEX "SavedListItem_approvedByUserId_idx" ON "SavedListItem"("approvedByUserId");

ALTER TABLE "SavedListItem"
  ADD CONSTRAINT "SavedListItem_addedByUserId_fkey"
  FOREIGN KEY ("addedByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "SavedListItem"
  ADD CONSTRAINT "SavedListItem_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "SavedListItem"
  ADD CONSTRAINT "SavedListItem_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId")
  REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
