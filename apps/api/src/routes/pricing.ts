import { Router } from 'express';
import { compareCartItemPricing } from '../services/pricingService';
import { getRetailerProductPriceHistory } from '../services/pricePredictionService';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { recordAuditEvent } from '../services/auditService';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('pricing', 120, 60 * 1000));
router.post('/compare', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { cartItemId, destinationRetailerProductId } = req.body;

  if (!cartItemId || !destinationRetailerProductId) {
    return res.status(400).json({ error: 'cartItemId and destinationRetailerProductId are required' });
  }

  try {
    const comparison = await compareCartItemPricing(userId, cartItemId, destinationRetailerProductId);
    await recordAuditEvent({
      userId,
      action: 'pricing.compared',
      entityType: 'cart_item',
      entityId: cartItemId,
      summary: `Compared effective total for ${comparison.destination.retailerName}`,
      metadata: {
        destinationRetailerProductId,
        source: comparison.source,
        destination: comparison.destination,
        recommendation: comparison.recommendation,
      },
    });
    return res.json(comparison);
  } catch (error: any) {
    const status = error.message === 'Cart item not found' || error.message === 'Destination retailer product not found' ? 404 : 400;
    return res.status(status).json({ error: error.message || 'Unable to compare pricing' });
  }
});

router.get('/:retailerProductId/history', async (req, res) => {
  const { retailerProductId } = req.params;
  const days = req.query.days != null ? Number(req.query.days) : 90;

  if (!retailerProductId) {
    return res.status(400).json({ error: 'retailerProductId is required' });
  }
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return res.status(400).json({ error: 'days must be between 1 and 365' });
  }

  const result = await getRetailerProductPriceHistory(retailerProductId, days);
  return res.json(result);
});

export default router;
