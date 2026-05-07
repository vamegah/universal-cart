import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { optimizeShippingPlans } from '../services/shippingOptimizerService';
import { estimateShippingRates } from '../services/shippingRateService';
import { prisma } from '../index';
import { recordAuditEvent } from '../services/auditService';

const router = Router();
router.use(requireAuth);
router.use(rateLimit('shipping', 60, 60 * 1000));

// POST /shipping/optimize — compare cost/speed/package plans
router.post('/optimize', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items are required' });
  }
  return res.json(optimizeShippingPlans(items));
});

// POST /shipping/rates — estimate carrier rates for a list of requests
router.post('/rates', async (req, res) => {
  const { requests } = req.body;
  if (!Array.isArray(requests) || requests.length === 0) {
    return res.status(400).json({ error: 'requests array is required' });
  }
  try {
    const rates = await estimateShippingRates(requests);
    return res.json({ rates });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Rate estimation failed' });
  }
});

// POST /shipping/select — persist the user's chosen shipping plan
router.post('/select', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { planName, planData, totalCost, cartId } = req.body;

  if (!planName || !planData) {
    return res.status(400).json({ error: 'planName and planData are required' });
  }

  const plan = await prisma.userShippingPlan.create({
    data: {
      userId,
      cartId: cartId ?? null,
      planName: String(planName),
      planData: planData as any,
      totalCost: Number(totalCost ?? 0),
    },
  });

  await recordAuditEvent({
    userId,
    action: 'shipping.plan_selected',
    entityType: 'user_shipping_plan',
    entityId: plan.id,
    summary: `Selected shipping plan: ${planName}`,
    metadata: { planName, totalCost, cartId },
  });

  return res.status(201).json({ plan });
});

// GET /shipping/selected — retrieve the most recent saved shipping plan
router.get('/selected', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { cartId } = req.query;

  const where: any = { userId };
  if (cartId) where.cartId = String(cartId);

  const plan = await prisma.userShippingPlan.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (!plan) return res.status(404).json({ error: 'No saved shipping plan found' });
  return res.json({ plan });
});

export default router;
