import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateAutoBuySafetyConfig } from '../services/autoBuySafetyService';

export async function listAutoBuyRules(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;

  const rules = await prisma.autoBuyRule.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ rules });
}

export async function createAutoBuyRule(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { cartId, trigger, destinationPref = 'split_optimized', executionCardId, subscriptionCadence } = req.body;

  if (!cartId || !trigger) {
    return res.status(400).json({ error: 'cartId and trigger are required' });
  }

  const cart = await prisma.universalCart.findFirst({ where: { id: cartId, userId } });
  if (!cart) return res.status(404).json({ error: 'Cart not found' });

  let parsedTrigger;
  try {
    parsedTrigger = typeof trigger === 'string' ? JSON.parse(trigger) : trigger;
  } catch {
    return res.status(400).json({ error: 'trigger must be valid JSON' });
  }

  const safetyError = validateAutoBuySafetyConfig(parsedTrigger);
  if (safetyError) return res.status(400).json({ error: safetyError });

  const rule = await prisma.autoBuyRule.create({
    data: {
      userId,
      cartId,
      trigger: parsedTrigger,
      subscriptionCadence: subscriptionCadence || undefined,
      destinationPref,
      executionCardId,
    },
  });

  return res.status(201).json(rule);
}

export async function updateAutoBuyRule(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;
  const { trigger, destinationPref, executionCardId, status, subscriptionCadence } = req.body || {};

  const existing = await prisma.autoBuyRule.findFirst({ where: { id, userId } });
  if (!existing) return res.status(404).json({ error: 'Auto-buy rule not found' });

  const data: Record<string, unknown> = {};
  if (trigger !== undefined) {
    try {
      data.trigger = typeof trigger === 'string' ? JSON.parse(trigger) : trigger;
    } catch {
      return res.status(400).json({ error: 'trigger must be valid JSON' });
    }
    const safetyError = validateAutoBuySafetyConfig(data.trigger);
    if (safetyError) return res.status(400).json({ error: safetyError });
  }
  if (destinationPref !== undefined) data.destinationPref = destinationPref;
  if (executionCardId !== undefined) data.executionCardId = executionCardId || null;
  if (subscriptionCadence !== undefined) data.subscriptionCadence = subscriptionCadence || null;
  if (status !== undefined) {
    const allowed = new Set(['active', 'executed', 'paused']);
    if (!allowed.has(status)) return res.status(400).json({ error: 'status must be active, executed, or paused' });
    data.status = status;
  }

  const updated = await prisma.autoBuyRule.update({
    where: { id },
    data,
  });

  return res.json(updated);
}

export async function deleteAutoBuyRule(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;

  const existing = await prisma.autoBuyRule.findFirst({ where: { id, userId } });
  if (!existing) return res.status(404).json({ error: 'Auto-buy rule not found' });

  await prisma.autoBuyRule.delete({ where: { id } });
  return res.status(204).send();
}
