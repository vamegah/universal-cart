import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../middleware/auth';
import { getBudgetSummary } from '../services/budgetService';
import { prisma } from '../index';
import { recordAuditEvent } from '../services/auditService';

const router = Router();
router.use(requireAuth);

// GET /api/budget/summary
router.get('/summary', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    const summary = await getBudgetSummary(userId);
    return res.json({ summary });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Unable to load budget summary' });
  }
});

// POST /api/budget/alerts — subscribe to a budget_exceeded alert for a threshold type
router.post('/alerts', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const alertType = String(req.body?.alertType || 'budget_exceeded').trim();
  const targetAmount = req.body?.targetAmount != null ? Number(req.body.targetAmount) : null;

  const SUPPORTED = new Set(['budget_exceeded', 'monthly_cap_warning', 'monthly_cap_reached']);
  if (!SUPPORTED.has(alertType)) {
    return res.status(400).json({ error: 'unsupported budget alert type' });
  }
  if (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount < 0)) {
    return res.status(400).json({ error: 'targetAmount must be a non-negative number' });
  }

  // Budget alerts are stored as AlertSubscription with a sentinel productId
  // pointing to a system-level "budget" product placeholder, or we store them
  // in the user's preferences metadata. We use preferences metadata to avoid
  // requiring a product row for a non-product alert.
  const preferences = await prisma.userPreferences.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const existing = (preferences.shippingPref as any) ?? {};
  const budgetAlerts: Record<string, any> = existing.budgetAlerts ?? {};
  budgetAlerts[alertType] = { enabled: true, targetAmount: targetAmount ?? null, updatedAt: new Date().toISOString() };

  await prisma.userPreferences.update({
    where: { userId },
    data: { shippingPref: { ...existing, budgetAlerts } },
  });

  await recordAuditEvent({
    userId,
    action: 'budget.alert_set',
    entityType: 'user_preferences',
    entityId: preferences.id,
    summary: `Set ${alertType} budget alert`,
    metadata: { alertType, targetAmount },
  });

  return res.status(201).json({ alertType, targetAmount, enabled: true });
});

export default router;
