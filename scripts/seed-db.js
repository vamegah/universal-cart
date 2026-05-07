// scripts/seed-db.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'test@universalcart.com' },
    update: {},
    create: {
      email: 'test@universalcart.com',
      passwordHash: 'dummy-hash',
      preferences: {
        create: {
          defaultStore: 'Amazon',
          shippingPref: JSON.stringify({ zip: '90210', country: 'US' }),
        },
      },
      cards: {
        create: [
          { retailerName: 'Amazon', cardToken: 'tok_amazon', cardLast4: '1234', rewardsRate: 0.05 },
          { retailerName: "Macy's", cardToken: 'tok_macys', cardLast4: '5678', rewardsRate: 0.03, financingTerms: JSON.stringify({ minAmount: 500, months: 6, apr: 0 }) },
        ],
      },
    },
    include: { preferences: true, cards: true },
  });
  console.log(`✅ Created user: ${user.email}`);

  // Create sample products
  const productsData = [
    { name: 'Sony WH-1000XM5 Headphones', brand: 'Sony', model: 'WH1000XM5', upc: '027242914405', category: 'Electronics', imageUrl: 'https://example.com/sony.jpg' },
    { name: 'Apple AirPods Pro 2', brand: 'Apple', model: 'A2931', upc: '194252905480', category: 'Electronics', imageUrl: 'https://example.com/airpods.jpg' },
    { name: 'Nike Air Max 90', brand: 'Nike', model: 'Air Max 90', upc: '193317050223', category: 'Shoes', imageUrl: 'https://example.com/nike.jpg' },
  ];

  for (const prod of productsData) {
    const product = await prisma.product.upsert({
      where: { upc: prod.upc },
      update: {},
      create: prod,
    });
    console.log(`📦 Product: ${product.name}`);

    // Add retailer-specific entries
    const retailers = ['Amazon', 'Walmart', 'Target', "Macy's"];
    for (const retailer of retailers) {
      const price = (Math.random() * 100 + 50).toFixed(2);
      await prisma.retailerProduct.upsert({
        where: {
          // Use composite unique in schema? For simplicity, create unique constraint later.
          // For now, use a custom findOrCreate logic.
          id: `${product.id}_${retailer}`,
        },
        update: { price: parseFloat(price), lastUpdated: new Date() },
        create: {
          id: `${product.id}_${retailer}`,
          productId: product.id,
          retailerName: retailer,
          retailerSku: `${retailer}-${product.upc}`,
          price: parseFloat(price),
          shippingCost: retailer === 'Amazon' ? 0 : 5.99,
          taxRate: 0.08,
          url: `https://${retailer.toLowerCase()}.com/product/${product.id}`,
          inStock: true,
        },
      });
    }
  }

  // Create a universal cart for the test user
  const cart = await prisma.universalCart.create({
    data: {
      userId: user.id,
      status: 'active',
      items: {
        create: [
          {
            productId: (await prisma.product.findFirst({ where: { name: 'Sony WH-1000XM5 Headphones' } })).id,
            sourceRetailer: 'Amazon',
            quantity: 1,
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`🛒 Created cart with ID: ${cart.id}`);

  console.log('✅ Seeding complete.');
}

main()
  .catch(e => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });