import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  GiftCardServiceError,
  listGiftCards as listGiftCardsService,
  purchaseGiftCard as purchaseGiftCardService,
} from '../services/giftCardService';

export async function purchaseGiftCard(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { retailerName, amount } = req.body || {};

  try {
    const giftCard = await purchaseGiftCardService(userId, retailerName, amount);
    return res.status(201).json(giftCard);
  } catch (error) {
    if (error instanceof GiftCardServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Unable to purchase gift card' });
  }
}

export async function listGiftCards(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;

  try {
    const giftCards = await listGiftCardsService(userId);
    return res.json({ giftCards });
  } catch {
    return res.status(500).json({ error: 'Unable to list gift cards' });
  }
}
