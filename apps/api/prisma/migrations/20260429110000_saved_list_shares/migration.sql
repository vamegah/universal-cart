CREATE TABLE "SavedListShare" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "invitedEmail" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedListShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedListShare_listId_userId_key" ON "SavedListShare"("listId", "userId");
CREATE INDEX "SavedListShare_userId_idx" ON "SavedListShare"("userId");
CREATE INDEX "SavedListShare_listId_idx" ON "SavedListShare"("listId");

ALTER TABLE "SavedListShare"
  ADD CONSTRAINT "SavedListShare_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "SavedList"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavedListShare"
  ADD CONSTRAINT "SavedListShare_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
