// src/controllers/cartController.ts
import { Request, Response } from 'express';
import { getOrCreateCart, addItemToCart, removeCartItem, updateCartItemQuantity, clearActiveCart } from '../services/cartService';
import { AuthenticatedRequest } from '../middleware/auth';
import { buildCartGroups, getCartDuplicateGroupKey } from '../services/cartGroupingService';

export function normalizeCartItem(item: any) {
  const selectedMatch = item.matchResults?.find((match: any) => match.isSelected);
  const sourceListing = item.product?.retailerProducts?.find((listing: any) => listing.retailerName === item.sourceRetailer);
  const product = item.product
    ? {
        ...item.product,
        attributes: item.product.attributes || undefined,
      }
    : null;

  const normalized = {
    ...item,
    product,
    matchType: selectedMatch?.matchType,
    matchConfidence: selectedMatch?.confidenceScore,
    confidenceScore: selectedMatch?.confidenceScore,
    selectedRetailerProductId: selectedMatch?.retailerProductId,
    matchedRetailer: selectedMatch?.retailerProduct?.retailerName,
    matchedPrice: selectedMatch?.retailerProduct?.price,
    matchedUrl: selectedMatch?.retailerProduct?.url,
    sourceListing: sourceListing
      ? {
          id: sourceListing.id,
          retailerName: sourceListing.retailerName,
          retailerSku: sourceListing.retailerSku,
          price: sourceListing.price,
          shippingCost: sourceListing.shippingCost,
          taxRate: sourceListing.taxRate,
          url: sourceListing.url,
          inStock: sourceListing.inStock,
          lastUpdated: sourceListing.lastUpdated,
        }
      : null,
  };
  return {
    ...normalized,
    duplicateGroupKey: getCartDuplicateGroupKey(normalized),
  };
}

export async function getCart(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const cart = await getOrCreateCart(userId);
  const items = cart.items.map(normalizeCartItem);
  return res.json({
    ...cart,
    items,
    groups: buildCartGroups(items),
  });
}

export async function addItem(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { productId, sourceRetailer, quantity } = req.body;
  const item = await addItemToCart(userId, productId, sourceRetailer, quantity);
  return res.json(item);
}

export async function deleteItem(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  await removeCartItem(userId, id);
  return res.status(204).send();
}

export async function updateQuantity(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const { quantity } = req.body;
  const item = await updateCartItemQuantity(userId, id, quantity);
  return res.json(item);
}

export async function clearCart(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const result = await clearActiveCart(userId);
  return res.json({ removed: result.count });
}
