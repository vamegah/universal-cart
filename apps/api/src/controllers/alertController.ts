import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';

const SUPPORTED_ALERT_TYPES = new Set([
  'price_drop',
  'restock',
  'transfer_opportunity',
  'promo_expiration',
  'card_offer',
]);

function includeProduct() {
  return {
    product: {
      include: {
        retailerProducts: true,
      },
    },
  };
}

function parseTargetPrice(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const targetPrice = Number(value);
  if (!Number.isFinite(targetPrice) || targetPrice < 0) {
    throw new Error('targetPrice must be a non-negative number');
  }
  return targetPrice;
}

export async function listAlertSubscriptions(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const alerts = await prisma.alertSubscription.findMany({
    where: { userId },
    include: includeProduct(),
    orderBy: { updatedAt: 'desc' },
  });

  return res.json({ alerts });
}

export async function createAlertSubscription(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const productId = String(req.body?.productId || '').trim();
  const alertType = String(req.body?.alertType || 'price_drop').trim();

  if (!productId) return res.status(400).json({ error: 'productId is required' });
  if (!SUPPORTED_ALERT_TYPES.has(alertType)) return res.status(400).json({ error: 'unsupported alertType' });

  let targetPrice: number | null;
  try {
    targetPrice = parseTargetPrice(req.body?.targetPrice);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = await prisma.alertSubscription.findFirst({
    where: { userId, productId, alertType, status: 'active' },
  });

  const alert = existing
    ? await prisma.alertSubscription.update({
        where: { id: existing.id },
        data: { targetPrice },
        include: includeProduct(),
      })
    : await prisma.alertSubscription.create({
        data: {
          userId,
          productId,
          alertType,
          targetPrice,
        },
        include: includeProduct(),
      });

  await recordAuditEvent({
    userId,
    action: existing ? 'alert.updated' : 'alert.created',
    entityType: 'alert_subscription',
    entityId: alert.id,
    summary: `${existing ? 'Updated' : 'Created'} ${alertType} alert for ${product.name}`,
    metadata: { productId, alertType, targetPrice },
  });

  return res.status(existing ? 200 : 201).json({ alert });
}

export async function updateAlertSubscription(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const data: { targetPrice?: number | null; status?: string } = {};

  const existing = await prisma.alertSubscription.findFirst({ where: { id, userId } });
  if (!existing) return res.status(404).json({ error: 'Alert not found' });

  if (req.body?.status !== undefined) {
    const status = String(req.body.status);
    if (!['active', 'paused', 'triggered'].includes(status)) {
      return res.status(400).json({ error: 'unsupported status' });
    }
    data.status = status;
  }

  if (req.body?.targetPrice !== undefined) {
    try {
      data.targetPrice = parseTargetPrice(req.body.targetPrice);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  const alert = await prisma.alertSubscription.update({
    where: { id },
    data,
    include: includeProduct(),
  });

  await recordAuditEvent({
    userId,
    action: 'alert.updated',
    entityType: 'alert_subscription',
    entityId: alert.id,
    summary: `Updated ${alert.alertType} alert`,
    metadata: data,
  });

  return res.json({ alert });
}

export async function deleteAlertSubscription(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const existing = await prisma.alertSubscription.findFirst({ where: { id, userId } });

  if (!existing) return res.status(404).json({ error: 'Alert not found' });

  await prisma.alertSubscription.delete({ where: { id } });
  await recordAuditEvent({
    userId,
    action: 'alert.deleted',
    entityType: 'alert_subscription',
    entityId: id,
    summary: `Deleted ${existing.alertType} alert`,
  });

  return res.status(204).send();
}
