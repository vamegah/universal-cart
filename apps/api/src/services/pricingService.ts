import { prisma } from '../index';
import { evaluateCoupons } from './couponService';
import { calculateLoyaltyValue, getLoyaltyMembership } from './loyaltyService';

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function estimateLineTotal(retailerProduct: any, quantity: number, rewardsRate: number, loyaltyMembership: any) {
  const base = retailerProduct.price * quantity;
  const shipping = retailerProduct.shippingCost ?? 0;
  const taxRate = retailerProduct.taxRate ?? 0;
  const tax = base * taxRate;
  const coupons = await evaluateCoupons({
    retailerName: retailerProduct.retailerName,
    subtotal: base,
    category: retailerProduct.product?.category,
  });
  const subtotal = base + shipping + tax - coupons.appliedSavings;
  const rewardsValue = base * rewardsRate;
  const loyalty = calculateLoyaltyValue(base, loyaltyMembership);
  const effectiveTotal = Math.max(0, subtotal - rewardsValue - loyalty.totalValue);

  return {
    retailerName: retailerProduct.retailerName,
    retailerProductId: retailerProduct.id,
    base: roundMoney(base),
    shipping: roundMoney(shipping),
    tax: roundMoney(tax),
    coupons,
    rewardsRate,
    rewardsValue: roundMoney(rewardsValue),
    loyalty: {
      pointsEarned: Math.round(loyalty.pointsEarned),
      pointsValue: roundMoney(loyalty.pointsValue),
      thresholdValue: roundMoney(loyalty.thresholdValue),
      totalValue: roundMoney(loyalty.totalValue),
      details: loyalty.details,
    },
    totalBeforeRewards: roundMoney(subtotal),
    effectiveTotal: roundMoney(effectiveTotal),
    inStock: retailerProduct.inStock,
    lastUpdated: retailerProduct.lastUpdated,
  };
}

async function rewardRateForRetailer(userId: string, retailerName: string) {
  const card = await prisma.userCard.findFirst({
    where: { userId, retailerName: { equals: retailerName, mode: 'insensitive' } },
    orderBy: { rewardsRate: 'desc' },
  });
  return card?.rewardsRate ?? 0;
}

export async function calculateTotalCost(
  retailerProductId: string,
  _userZipCode?: string
): Promise<{ total: number; breakdown: any }> {
  const rp = await prisma.retailerProduct.findUnique({
    where: { id: retailerProductId },
  });
  if (!rp) throw new Error('Retailer product not found');
  // Simple estimation: shipping $5 flat, tax 8%
  const shipping = rp.shippingCost || 5;
  const taxRate = rp.taxRate || 0.08;
  const tax = rp.price * taxRate;
  const total = rp.price + shipping + tax;
  return {
    total,
    breakdown: { base: rp.price, shipping, tax },
  };
}

export async function compareCartItemPricing(
  userId: string,
  cartItemId: string,
  destinationRetailerProductId: string
) {
  const cartItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { userId } },
    include: {
      cart: {
        include: {
          user: {
            include: { preferences: true },
          },
        },
      },
      product: {
        include: {
          retailerProducts: true,
        },
      },
    },
  });

  if (!cartItem) throw new Error('Cart item not found');

  const sourceListing =
    cartItem.product.retailerProducts.find((listing) => listing.retailerName === cartItem.sourceRetailer) ||
    cartItem.product.retailerProducts[0];

  const destinationListing = await prisma.retailerProduct.findUnique({
    where: { id: destinationRetailerProductId },
    include: { product: true },
  });

  if (!destinationListing) throw new Error('Destination retailer product not found');

  const sourceRewardsRate = sourceListing ? await rewardRateForRetailer(userId, sourceListing.retailerName) : 0;
  const destinationRewardsRate = await rewardRateForRetailer(userId, destinationListing.retailerName);
  const preferences = cartItem.cart.user.preferences;
  const sourceLoyalty = sourceListing ? getLoyaltyMembership(preferences, sourceListing.retailerName) : null;
  const destinationLoyalty = getLoyaltyMembership(preferences, destinationListing.retailerName);

  const source = sourceListing
    ? await estimateLineTotal(sourceListing, cartItem.quantity, sourceRewardsRate, sourceLoyalty)
    : null;
  const destination = await estimateLineTotal(destinationListing, cartItem.quantity, destinationRewardsRate, destinationLoyalty);

  const savings = source ? roundMoney(source.effectiveTotal - destination.effectiveTotal) : null;

  return {
    cartItemId,
    quantity: cartItem.quantity,
    product: {
      id: cartItem.product.id,
      name: cartItem.product.name,
      brand: cartItem.product.brand,
      model: cartItem.product.model,
      upc: cartItem.product.upc,
    },
    source,
    destination,
    recommendation: {
      cheaperDestination: savings === null ? null : savings > 0,
      effectiveSavings: savings,
      explanation:
        savings === null
          ? 'No source listing is available for comparison.'
          : savings > 0
            ? `Destination is cheaper by ${savings.toFixed(2)} after estimated tax, shipping, and rewards.`
            : savings < 0
              ? `Source is cheaper by ${Math.abs(savings).toFixed(2)} after estimated tax, shipping, and rewards.`
              : 'Source and destination are equal after estimated tax, shipping, and rewards.',
    },
  };
}
