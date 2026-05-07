-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultStore" TEXT,
    "defaultCardId" TEXT,
    "shippingPref" TEXT,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "cardToken" TEXT NOT NULL,
    "cardLast4" TEXT NOT NULL,
    "rewardsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "financingTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "upc" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "attributes" TEXT,
    "rawMetadata" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "retailerSku" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversalCart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "UniversalCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceRetailer" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "cartItemId" TEXT NOT NULL,
    "retailerProductId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SplitPlan" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "assignment" TEXT NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SplitPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoBuyRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "destinationPref" TEXT NOT NULL,
    "executionCardId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "AutoBuyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualCardTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retailerName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "virtualCardLast4" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_upc_key" ON "Product"("upc");

-- CreateIndex
CREATE UNIQUE INDEX "RetailerProduct_retailerName_retailerSku_key" ON "RetailerProduct"("retailerName", "retailerSku");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerProduct" ADD CONSTRAINT "RetailerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversalCart" ADD CONSTRAINT "UniversalCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "UniversalCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_cartItemId_fkey" FOREIGN KEY ("cartItemId") REFERENCES "CartItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_retailerProductId_fkey" FOREIGN KEY ("retailerProductId") REFERENCES "RetailerProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SplitPlan" ADD CONSTRAINT "SplitPlan_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "UniversalCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoBuyRule" ADD CONSTRAINT "AutoBuyRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoBuyRule" ADD CONSTRAINT "AutoBuyRule_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "UniversalCart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
