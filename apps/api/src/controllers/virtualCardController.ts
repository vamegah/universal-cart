import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { checkoutWithVirtualCard, issueVirtualCard } from '../services/virtualCardService';
import { getVirtualCardProviderReadiness } from '../services/paymentModeService';

function parseAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function issueCard(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const amount = parseAmount(req.body?.amount);
  const merchantName = String(req.body?.merchantName || '').trim();

  if (amount == null || !merchantName) {
    return res.status(400).json({ error: 'amount and merchantName are required' });
  }

  try {
    const card = await issueVirtualCard(amount, merchantName, userId);
    return res.status(201).json({ card });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to issue virtual card';
    const status = message.includes('configured') || message.includes('Unsupported BaaS provider') ? 503 : 400;
    return res.status(status).json({ error: message });
  }
}

export async function checkoutWithCard(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const cartId = String(req.body?.cartId || '').trim();
  const userCardId = req.body?.userCardId ? String(req.body.userCardId) : undefined;

  if (!cartId) {
    return res.status(400).json({ error: 'cartId is required' });
  }

  try {
    const result = await checkoutWithVirtualCard(cartId, userId, userCardId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Virtual checkout failed';
    const status = message.includes('configured') || message.includes('Unsupported BaaS provider') ? 503 : 400;
    return res.status(status).json({ error: message });
  }
}

export async function providerStatus(_req: Request, res: Response) {
  return res.json({ providerStatus: getVirtualCardProviderReadiness() });
}
