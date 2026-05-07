import { Request, Response } from 'express';
import { prisma } from '../index';
import {
  getRetailerDefinition,
  getRetailerDefinitionByName,
  getSupportedRetailerNames,
} from '../integrations/registry';
import { AuthenticatedRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { getFinancingOptions } from '../services/financingArbitrageService';
import { getRetailerActionBlockReason, isRetailerActionAllowed } from '../services/complianceService';

function isAllowedStoreUrl(store: string, value: string) {
  try {
    const retailerDefinition = getRetailerDefinition(value);
    return retailerDefinition?.name.toLowerCase() === store.toLowerCase();
  } catch {
    return false;
  }
}

function getCheckoutItemIdentifier(item: any) {
  return item.retailerSku || item.matchedProductId || item.productId || item.sku;
}

function getCheckoutItemListingUrl(item: any) {
  return item.matchedUrl || item.url || item.sourceUrl;
}

async function findRetailerProductForItem(item: any) {
  if (item.matchedProductId) {
    return prisma.retailerProduct.findUnique({ where: { id: item.matchedProductId }, include: { product: true } });
  }

  if (item.sourceRetailer && item.retailerSku) {
    return prisma.retailerProduct.findUnique({
      where: {
        retailerName_retailerSku: {
          retailerName: item.sourceRetailer,
          retailerSku: item.retailerSku,
        },
      },
      include: { product: true },
    });
  }

  const listingUrl = getCheckoutItemListingUrl(item);
  if (listingUrl) {
    return prisma.retailerProduct.findFirst({ where: { url: listingUrl }, include: { product: true } });
  }

  return null;
}

function normalizeVariantValue(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getVariantKey(attributes: any) {
  if (!attributes || typeof attributes !== 'object') return '';

  const explicitKey = normalizeVariantValue(attributes.variantKey);
  if (explicitKey) return explicitKey;

  const color = normalizeVariantValue(attributes.color);
  const size = normalizeVariantValue(attributes.size);
  return [color, size].filter(Boolean).join(' ');
}

function createCheckoutItemStatus(item: any, retailerProduct: any) {
  const issues: Array<{ type: 'error' | 'warning'; message: string }> = [];

  const quantity = Number(item.quantity ?? 1);
  if (quantity <= 0) {
    issues.push({ type: 'error', message: 'Quantity must be at least 1.' });
  }

  if (retailerProduct) {
    if (!retailerProduct.inStock) {
      issues.push({ type: 'error', message: 'This item is no longer in stock at the retailer.' });
    }

    if (typeof item.price === 'number' && retailerProduct.price !== item.price) {
      issues.push({
        type: 'warning',
        message: `Price has changed at ${retailerProduct.retailerName}: ${item.price.toFixed(2)} -> ${retailerProduct.price.toFixed(2)}.`,
      });
    }

    const itemVariantKey = getVariantKey(item.attributes);
    const retailerVariantKey = getVariantKey(retailerProduct.product?.attributes);
    if (itemVariantKey && retailerVariantKey && itemVariantKey !== retailerVariantKey) {
      issues.push({
        type: 'error',
        message: 'Selected variant no longer matches the retailer listing.',
      });
    } else if (item.matchedProductId && itemVariantKey && !retailerVariantKey) {
      issues.push({
        type: 'warning',
        message: 'Selected variant could not be verified against the retailer listing.',
      });
    }
  }

  const matchType = String(item.matchType || '').toLowerCase();
  if (item.matchedProductId && matchType && matchType !== 'exact' && item.substituteApproved !== true) {
    issues.push({
      type: 'error',
      message: `${item.productName || 'This item'} is a ${matchType} match and needs approval before checkout.`,
    });
  }

  return {
    item,
    retailerProduct,
    issues,
  };
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getCartEstimatedTotal(items: any[]) {
  return items.reduce((sum, item) => {
    const price = Number(item.matchedPrice ?? item.price ?? 0);
    const quantity = Number(item.quantity ?? 1);
    return sum + price * quantity;
  }, 0);
}

async function evaluateCheckoutReadiness(userId: string, items: any[], store: string) {
  const supported = isStoreSupportedForItems(store, items);
  const supportReason = getStoreSupportReason(store, items);
  const preferences = await prisma.userPreferences.findUnique({ where: { userId } });
  const shippingPref = preferences?.shippingPref as any;
  const budgetControls = shippingPref?.budgetControls || {};
  const maxOrderBudget = asNumber(budgetControls.maxOrderBudget);
  const monthlyFinancingCap = asNumber(budgetControls.monthlyFinancingCap);
  const preferredInstallmentAmount = asNumber(budgetControls.preferredInstallmentAmount);
  const estimatedTotal = getCartEstimatedTotal(items);

  const itemStatuses = await Promise.all(
    items.map(async (item: any) => {
      const retailerProduct = await findRetailerProductForItem(item);
      return createCheckoutItemStatus(item, retailerProduct);
    })
  );

  const errors = itemStatuses.flatMap((result) => result.issues.filter((issue) => issue.type === 'error'));
  const warnings = itemStatuses.flatMap((result) => result.issues.filter((issue) => issue.type === 'warning'));

  if (!supported) {
    errors.unshift({ type: 'error', message: supportReason || 'This store is not compatible with the selected items.' });
  }

  if (maxOrderBudget != null && estimatedTotal > maxOrderBudget) {
    errors.push({
      type: 'error',
      message: `Estimated checkout total ${estimatedTotal.toFixed(2)} exceeds your max order budget of ${maxOrderBudget.toFixed(2)}.`,
    });
  }

  if (monthlyFinancingCap != null && estimatedTotal > monthlyFinancingCap) {
    warnings.push({
      type: 'warning',
      message: `Estimated checkout total ${estimatedTotal.toFixed(2)} exceeds your monthly financing cap of ${monthlyFinancingCap.toFixed(2)}.`,
    });
  }

  if (preferredInstallmentAmount != null && estimatedTotal > preferredInstallmentAmount) {
    warnings.push({
      type: 'warning',
      message: `Estimated checkout total is above your preferred installment amount of ${preferredInstallmentAmount.toFixed(2)}.`,
    });
  }

  return {
    ready: errors.length === 0,
    supported,
    errors,
    warnings,
    itemStatuses,
    estimatedTotal,
    budgetControls: {
      maxOrderBudget,
      monthlyFinancingCap,
      preferredInstallmentAmount,
    },
  };
}

export async function getCheckoutStores(_req: Request, res: Response) {
  return res.json({ supportedStores: getSupportedRetailerNames() });
}

export async function getCheckoutFinancingOptions(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const totalAmount = Number(req.query.totalAmount);

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return res.status(400).json({ error: 'totalAmount query parameter must be greater than 0' });
  }

  try {
    const options = await getFinancingOptions(userId, totalAmount);
    await recordAuditEvent({
      userId,
      action: 'checkout.financing_options_viewed',
      entityType: 'checkout',
      summary: `Viewed financing options for ${totalAmount.toFixed(2)}`,
      metadata: {
        totalAmount,
        optionCount: options.length,
        eligibleRetailers: options.map((option) => option.retailerName),
      },
    });
    return res.json({ options });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load financing options';
    return res.status(400).json({ error: message });
  }
}

function isStoreSupportedForItems(store: string, items: any[]) {
  if (store.toLowerCase() === 'amazon') {
    return items.length > 0 && items.every((item) => Boolean(getCheckoutItemIdentifier(item)) && Number(item.quantity || 1) > 0);
  }

  if (items.length !== 1) {
    return false;
  }

  const item = items[0];
  const identifier = getCheckoutItemIdentifier(item);
  if (identifier) {
    return true;
  }

  const listingUrl = getCheckoutItemListingUrl(item);
  return Boolean(listingUrl && isAllowedStoreUrl(store, listingUrl));
}

function getStoreRouteType(store: string, items: any[]) {
  if (!isStoreSupportedForItems(store, items)) return 'unsupported';
  if (store.toLowerCase() === 'amazon') return 'cart_add';
  const item = items[0];
  const listingUrl = getCheckoutItemListingUrl(item);
  if (listingUrl && isAllowedStoreUrl(store, listingUrl)) return 'product_page';
  return 'single_item_cart_add';
}

function getStoreSupportReason(store: string, items: any[]) {
  if (isStoreSupportedForItems(store, items)) {
    return '';
  }

  if (store.toLowerCase() === 'amazon') {
    return 'Amazon checkout requires a retailer SKU or product identifier and quantity for every cart item.';
  }

  if (items.length !== 1) {
    return 'Non-Amazon checkout currently supports only one cart item at a time.';
  }

  const item = items[0];
  const identifier = getCheckoutItemIdentifier(item);
  if (identifier) {
    return '';
  }

  const listingUrl = getCheckoutItemListingUrl(item);
  if (!listingUrl) {
    return `No product URL or retailer identifier is available for ${store}.`;
  }

  if (!isAllowedStoreUrl(store, listingUrl)) {
    return `The product page URL is not a verified ${store} listing.`;
  }

  return `A valid ${store} product page or identifier is required for checkout.`;
}

function getStoreRouteMessage(store: string, items: any[]) {
  const routeType = getStoreRouteType(store, items);
  if (routeType === 'cart_add') {
    return 'Creates a supported merchant cart-add redirect for the selected items.';
  }
  if (routeType === 'product_page') {
    return 'Redirects to the verified merchant product page so the purchase can be completed on the retailer site.';
  }
  if (routeType === 'single_item_cart_add') {
    return 'Creates a supported single-item cart redirect for this merchant.';
  }
  return getStoreSupportReason(store, items);
}

export function getCheckoutSupportStatus(store: string, items: any[]) {
  const supported = isStoreSupportedForItems(store, items);
  const routeType = getStoreRouteType(store, items);
  return {
    name: store,
    supported,
    routeType,
    reason: supported ? '' : getStoreSupportReason(store, items),
    message: getStoreRouteMessage(store, items),
    limitations:
      store.toLowerCase() === 'amazon'
        ? []
        : ['Non-Amazon checkout is intentionally limited to a single verified product-page or supported single-item route.'],
  };
}

export async function validateCheckoutReadiness(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { items, store } = req.body;
  if (!Array.isArray(items) || !store) {
    return res.status(400).json({ error: 'items and store are required' });
  }

  const readiness = await evaluateCheckoutReadiness(userId, items, store);
  await recordAuditEvent({
    userId,
    action: 'checkout.validated',
    entityType: 'checkout',
    summary: readiness.ready ? `Checkout validated for ${store}` : `Checkout blocked for ${store}`,
    metadata: {
      store,
      itemCount: items.length,
      estimatedTotal: readiness.estimatedTotal,
      budgetControls: readiness.budgetControls,
      ready: readiness.ready,
      supported: readiness.supported,
      errors: readiness.errors,
      warnings: readiness.warnings,
    },
  });

  return res.status(readiness.ready ? 200 : 422).json(readiness);
}

export async function getCheckoutStoreStatuses(req: Request, res: Response) {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array is required' });
  }

  const supportedStores = getSupportedRetailerNames().map((store) => getCheckoutSupportStatus(store, items));

  return res.json({ supportedStores });
}

export async function getCheckoutRedirectUrl(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { items, store } = req.body;
  if (!Array.isArray(items) || !store) {
    return res.status(400).json({ error: 'items and store are required' });
  }

  const retailerDefinition = getRetailerDefinitionByName(store);
  if (!retailerDefinition) {
    return res.status(422).json({
      error: 'Checkout routing is not supported for this merchant yet',
      supportedStores: getSupportedRetailerNames(),
    });
  }

  const readiness = await evaluateCheckoutReadiness(userId, items, store);
  if (!readiness.ready || readiness.warnings.length > 0) {
    await recordAuditEvent({
      userId,
      action: 'checkout.redirect_blocked',
      entityType: 'checkout',
      summary: `Blocked stale or unreviewed checkout redirect for ${store}`,
      metadata: {
        store,
        itemCount: items.length,
        estimatedTotal: readiness.estimatedTotal,
        errors: readiness.errors,
        warnings: readiness.warnings,
      },
    });
    return res.status(422).json({
      error: 'Checkout readiness validation failed',
      ...readiness,
    });
  }

  const addableItems = items
    .map((item) => ({
      sku: item.retailerSku || item.matchedProductId || item.productId || item.sku,
      quantity: Number(item.quantity || 1),
      listingUrl: item.matchedUrl || item.url || item.sourceUrl,
    }))
    .filter((item) => item.quantity > 0);

  if (retailerDefinition.name.toLowerCase() === 'amazon') {
    if (!isRetailerActionAllowed(retailerDefinition.name, 'cart_add_redirect')) {
      return res.status(422).json({ error: getRetailerActionBlockReason(retailerDefinition.name, 'cart_add_redirect') });
    }

    if (addableItems.length !== items.length || addableItems.some((item) => !item.sku)) {
      return res.status(422).json({ error: 'All checkout items require a retailer SKU and quantity for Amazon' });
    }

    const params = new URLSearchParams();
    addableItems.forEach((item, index) => {
      const position = index + 1;
      params.set(`ASIN.${position}`, item.sku);
      params.set(`Quantity.${position}`, String(item.quantity));
    });

    const redirectUrl = `https://www.amazon.com/gp/cart/add.html?${params.toString()}`;
    await recordAuditEvent({
      userId,
      action: 'checkout.redirect_created',
      entityType: 'checkout',
      summary: `Created Amazon cart redirect for ${items.length} item${items.length === 1 ? '' : 's'}`,
      metadata: {
        store: retailerDefinition.name,
        routeType: 'cart_add',
        itemCount: items.length,
      },
    });
    return res.json({
      redirectUrl,
      routeType: 'cart_add',
      message: getStoreRouteMessage(retailerDefinition.name, items),
    });
  }

  if (addableItems.length !== 1) {
    return res.status(422).json({
      error: 'This merchant currently supports single-item routing for checkout',
    });
  }

  const item = addableItems[0];
  const adapter = new retailerDefinition.adapter();

  if (item.listingUrl && isAllowedStoreUrl(store, item.listingUrl)) {
    if (!isRetailerActionAllowed(retailerDefinition.name, 'product_page_redirect')) {
      return res.status(422).json({ error: getRetailerActionBlockReason(retailerDefinition.name, 'product_page_redirect') });
    }
    await recordAuditEvent({
      userId,
      action: 'checkout.redirect_created',
      entityType: 'checkout',
      summary: `Created ${retailerDefinition.name} product-page redirect`,
      metadata: {
        store: retailerDefinition.name,
        routeType: 'product_page',
        listingUrl: item.listingUrl,
      },
    });
    return res.json({
      redirectUrl: item.listingUrl,
      routeType: 'product_page',
      message: getStoreRouteMessage(retailerDefinition.name, items),
    });
  }

  if (item.sku) {
    if (!isRetailerActionAllowed(retailerDefinition.name, 'cart_add_redirect')) {
      return res.status(422).json({ error: getRetailerActionBlockReason(retailerDefinition.name, 'cart_add_redirect') });
    }
    const redirectUrl = await adapter.addToCart(item.sku, item.quantity);
    await recordAuditEvent({
      userId,
      action: 'checkout.redirect_created',
      entityType: 'checkout',
      summary: `Created ${retailerDefinition.name} cart redirect`,
      metadata: {
        store: retailerDefinition.name,
        routeType: 'cart_add',
        quantity: item.quantity,
      },
    });
    return res.json({
      redirectUrl,
      routeType: 'single_item_cart_add',
      message: getStoreRouteMessage(retailerDefinition.name, items),
    });
  }

  return res.status(422).json({
    error: 'A verified product page URL or a retailer product identifier is required for this merchant',
  });
}
