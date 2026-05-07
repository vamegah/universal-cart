CREATE INDEX "UserCard_userId_idx" ON "UserCard"("userId");
CREATE INDEX "UserCard_retailerName_idx" ON "UserCard"("retailerName");

CREATE INDEX "RetailerProduct_productId_idx" ON "RetailerProduct"("productId");
CREATE INDEX "RetailerProduct_retailerName_idx" ON "RetailerProduct"("retailerName");
CREATE INDEX "RetailerProduct_url_idx" ON "RetailerProduct"("url");

CREATE INDEX "UniversalCart_userId_status_idx" ON "UniversalCart"("userId", "status");

CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
CREATE INDEX "CartItem_sourceRetailer_idx" ON "CartItem"("sourceRetailer");

CREATE INDEX "MatchResult_cartItemId_isSelected_idx" ON "MatchResult"("cartItemId", "isSelected");
CREATE INDEX "MatchResult_retailerProductId_idx" ON "MatchResult"("retailerProductId");

CREATE INDEX "SplitPlan_cartId_idx" ON "SplitPlan"("cartId");

CREATE INDEX "AutoBuyRule_userId_status_idx" ON "AutoBuyRule"("userId", "status");
CREATE INDEX "AutoBuyRule_cartId_idx" ON "AutoBuyRule"("cartId");

CREATE INDEX "VirtualCardTransaction_userId_createdAt_idx" ON "VirtualCardTransaction"("userId", "createdAt");
CREATE INDEX "VirtualCardTransaction_retailerName_idx" ON "VirtualCardTransaction"("retailerName");
