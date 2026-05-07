CREATE TABLE "SavedList" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SavedList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedListItem" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sourceRetailer" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SavedListItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedList_userId_updatedAt_idx" ON "SavedList"("userId", "updatedAt");
CREATE INDEX "SavedListItem_listId_idx" ON "SavedListItem"("listId");
CREATE INDEX "SavedListItem_productId_idx" ON "SavedListItem"("productId");

ALTER TABLE "SavedList"
  ADD CONSTRAINT "SavedList_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavedListItem"
  ADD CONSTRAINT "SavedListItem_listId_fkey"
  FOREIGN KEY ("listId") REFERENCES "SavedList"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavedListItem"
  ADD CONSTRAINT "SavedListItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
