// scripts/update-retailer-products.js
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Simulate fetching price from retailer API
async function fetchLatestPrice(retailerName, productId) {
  // In real implementation, call retailer's API or scrape
  // For demo, return a random price fluctuation
  const basePrice = 99.99;
  const variation = (Math.random() - 0.5) * 10;
  return Math.max(0.01, basePrice + variation);
}

async function updateAllProducts() {
  console.log('🔄 Updating retailer product prices...');
  const allRetailerProducts = await prisma.retailerProduct.findMany();
  let updated = 0;
  for (const rp of allRetailerProducts) {
    const newPrice = await fetchLatestPrice(rp.retailerName, rp.productId);
    await prisma.retailerProduct.update({
      where: { id: rp.id },
      data: { price: parseFloat(newPrice.toFixed(2)), lastUpdated: new Date() },
    });
    updated++;
  }
  console.log(`✅ Updated ${updated} retailer products.`);
  await prisma.$disconnect();
}

updateAllProducts().catch(console.error);