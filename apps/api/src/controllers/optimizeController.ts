import { Request, Response } from 'express';
import { prisma } from '../index';
import {
  getThresholdSuggestions,
  ItemCost,
  optimizeSplitPlan,
  optimizeSplitPlanGlobal,
  ShippingThreshold,
  SplitPlanResult,
} from '../services/splitOptimizerService';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { detectBundles } from '../services/bundleService';
import { CartRuleSet } from '../services/cartRulesService';

interface OptimizeRequest {
  cartId?: string;
  items: ItemCost[];
  userStores: string[];
  rules?: CartRuleSet;
  shippingThresholds?: ShippingThreshold[];
}

function getActiveCartRules(requestRules: CartRuleSet | undefined, preferences: any): CartRuleSet | undefined {
  if (requestRules && Object.keys(requestRules).length > 0) return requestRules;

  const shippingPref = preferences?.shippingPref as any;
  const savedRules = shippingPref?.cartRules;
  return savedRules && typeof savedRules === 'object' ? savedRules : undefined;
}

export async function optimizeCart(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { cartId, items, userStores, rules, shippingThresholds } = req.body as OptimizeRequest;

  if (!Array.isArray(items) || items.length === 0 || !Array.isArray(userStores) || userStores.length === 0) {
    return res.status(400).json({ error: 'items and userStores are required' });
  }

  try {
    const preferences = await prisma.userPreferences.findUnique({ where: { userId } });
    const activeRules = getActiveCartRules(rules, preferences);
    const plan = optimizeSplitPlan(items, userStores, activeRules, shippingThresholds, preferences);

    // Persist the plan when a cartId is supplied and belongs to the user.
    let savedPlan: { id: string } | null = null;
    if (cartId) {
      const cart = await prisma.universalCart.findFirst({
        where: { id: cartId, userId },
      });

      if (cart) {
        savedPlan = await prisma.splitPlan.create({
          data: {
            cartId: cart.id,
            assignment: plan as any,
            totalCost: plan.totalCost,
          },
        });
      }
    }

    return res.json({ ...plan, appliedRules: activeRules || null, splitPlanId: savedPlan?.id ?? null });
  } catch (error) {
    logger.error(`Optimize error: ${error}`);
    return res.status(500).json({ error: 'Optimization failed' });
  }
}

async function persistSplitPlan(cartId: string | undefined, userId: string, plan: SplitPlanResult) {
  if (!cartId) return null;

  const cart = await prisma.universalCart.findFirst({
    where: { id: cartId, userId },
  });

  if (!cart) return null;

  return prisma.splitPlan.create({
    data: {
      cartId: cart.id,
      assignment: plan as any,
      totalCost: plan.totalCost,
    },
  });
}

export async function optimizeCartGlobal(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { cartId, items, userStores, rules, shippingThresholds } = req.body as OptimizeRequest;

  if (!Array.isArray(items) || items.length === 0 || !Array.isArray(userStores) || userStores.length === 0) {
    return res.status(400).json({ error: 'items and userStores are required' });
  }

  try {
    const preferences = await prisma.userPreferences.findUnique({ where: { userId } });
    const activeRules = getActiveCartRules(rules, preferences);
    const plan = optimizeSplitPlanGlobal(items, userStores, activeRules, shippingThresholds, preferences);
    const savedPlan = await persistSplitPlan(cartId, userId, plan);
    return res.json({ ...plan, appliedRules: activeRules || null, splitPlanId: savedPlan?.id ?? null });
  } catch (error) {
    logger.error(`Global optimize error: ${error}`);
    return res.status(500).json({ error: 'Optimization failed' });
  }
}

export async function getLatestSplitPlan(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { cartId } = req.params;

  const cart = await prisma.universalCart.findFirst({
    where: { id: cartId, userId },
  });

  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  const plan = await prisma.splitPlan.findFirst({
    where: { cartId },
    orderBy: { createdAt: 'desc' },
  });

  if (!plan) return res.status(404).json({ error: 'No split plan found for this cart' });

  return res.json({ plan });
}

function parseThresholdQuery(value: unknown): ShippingThreshold[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getSplitPlanSuggestions(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { cartId } = req.params;

  const cart = await prisma.universalCart.findFirst({
    where: { id: cartId, userId },
  });

  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  const plan = await prisma.splitPlan.findFirst({
    where: { cartId },
    orderBy: { createdAt: 'desc' },
  });

  if (!plan) return res.status(404).json({ error: 'No split plan found for this cart' });

  const assignment = plan.assignment as any;
  const thresholds = parseThresholdQuery(req.query.thresholds);
  return res.json({
    suggestions: getThresholdSuggestions(assignment, thresholds),
  });
}

export async function getBundleSuggestions(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { cartId } = req.params;

  const cart = await prisma.universalCart.findFirst({
    where: { id: cartId, userId },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  const productIds = cart.items.map((item) => item.productId);
  const retailerProducts = await prisma.retailerProduct.findMany({
    where: {
      productId: { in: productIds },
      inStock: true,
    },
  });

  return res.json({
    bundles: detectBundles(cart.items, retailerProducts),
  });
}
