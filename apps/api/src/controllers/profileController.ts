import { Request, Response } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { assertTokenizedCardReference, encryptCardToken, requireCardVaultConsent } from '../services/paymentVaultService';

function normalizeRewardsRate(value: unknown) {
  const rate = Number(value ?? 0);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error('rewardsRate must be between 0 and 1');
  }
  return rate;
}

function toProfileResponse(profile: any) {
  return {
    preferences: profile.preferences,
    cards: profile.cards.map((card: any) => ({
      id: card.id,
      retailerName: card.retailerName,
      cardLast4: card.cardLast4,
      rewardsRate: card.rewardsRate,
      financingTerms: card.financingTerms || null,
      createdAt: card.createdAt,
    })),
  };
}

export async function getProfile(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { preferences: true, cards: { orderBy: { createdAt: 'desc' } } },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(toProfileResponse(user));
}

export async function upsertPreferences(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { defaultStore, defaultCardId, shippingPref } = req.body;

  const preferences = await prisma.userPreferences.upsert({
    where: { userId },
    update: {
      defaultStore: defaultStore ?? null,
      defaultCardId: defaultCardId ?? null,
      shippingPref: shippingPref ?? null,
    },
    create: {
      userId,
      defaultStore: defaultStore ?? null,
      defaultCardId: defaultCardId ?? null,
      shippingPref: shippingPref ?? null,
    },
  });

  await recordAuditEvent({
    userId,
    action: 'profile.preferences_updated',
    entityType: 'user_preferences',
    entityId: preferences.id,
    summary: 'Updated shopping preferences',
    metadata: {
      defaultStore: preferences.defaultStore,
      defaultCardId: preferences.defaultCardId,
      shippingPref: preferences.shippingPref,
    },
  });

  return res.json({ preferences });
}

export async function addCard(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { retailerName, cardToken, cardLast4, rewardsRate, financingTerms, consentAccepted } = req.body;

  if (!retailerName || !cardLast4) {
    return res.status(400).json({ error: 'retailerName and cardLast4 are required' });
  }

  try {
    requireCardVaultConsent(consentAccepted);
    const token = assertTokenizedCardReference(cardToken);
    const normalizedRate = normalizeRewardsRate(rewardsRate);

    if (!/^\d{4}$/.test(String(cardLast4))) {
      return res.status(400).json({ error: 'cardLast4 must be exactly 4 digits' });
    }

    const card = await prisma.userCard.create({
      data: {
        userId,
        retailerName: String(retailerName).trim(),
        cardToken: encryptCardToken(token),
        cardLast4: String(cardLast4),
        rewardsRate: normalizedRate,
        financingTerms: {
          ...(financingTerms && typeof financingTerms === 'object' ? financingTerms : {}),
          vault: {
            tokenProvider: token.split(/[_\-:]/)[0],
            consentAcceptedAt: new Date().toISOString(),
            scope: 'token_reference_only',
          },
        },
      },
    });

    await recordAuditEvent({
      userId,
      action: 'profile.card_added',
      entityType: 'user_card',
      entityId: card.id,
      summary: `Added ${card.retailerName} card reward reference`,
      metadata: {
        retailerName: card.retailerName,
        cardLast4: card.cardLast4,
        rewardsRate: card.rewardsRate,
        financingTerms: card.financingTerms,
      },
    });

    return res.status(201).json({
      card: {
        id: card.id,
        retailerName: card.retailerName,
        cardLast4: card.cardLast4,
        rewardsRate: card.rewardsRate,
        financingTerms: card.financingTerms || null,
        createdAt: card.createdAt,
      },
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Invalid card profile' });
  }
}

export async function deleteCard(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { id } = req.params;

  const card = await prisma.userCard.findFirst({ where: { id, userId } });
  if (!card) return res.status(404).json({ error: 'Card not found' });

  await prisma.userCard.delete({ where: { id } });
  await recordAuditEvent({
    userId,
    action: 'profile.card_removed',
    entityType: 'user_card',
    entityId: id,
    summary: `Removed ${card.retailerName} card reward reference`,
    metadata: {
      retailerName: card.retailerName,
      cardLast4: card.cardLast4,
    },
  });
  return res.status(204).send();
}

export async function upsertCardLinkedOffers(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const offers = req.body?.offers;

  if (!Array.isArray(offers)) {
    return res.status(400).json({ error: 'offers must be an array' });
  }

  // Validate each offer minimally.
  for (const offer of offers) {
    if (!offer.retailerName || !offer.description) {
      return res.status(400).json({ error: 'Each offer requires retailerName and description' });
    }
    if (offer.consentAccepted !== true) {
      return res.status(400).json({ error: 'Each offer requires user consent to store offer terms' });
    }
    if (!['percent', 'fixed'].includes(offer.discountType)) {
      return res.status(400).json({ error: 'discountType must be percent or fixed' });
    }
    if (typeof offer.discountValue !== 'number' || offer.discountValue < 0) {
      return res.status(400).json({ error: 'discountValue must be a non-negative number' });
    }
  }

  const preferences = await prisma.userPreferences.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const existing = (preferences.shippingPref as any) ?? {};
  await prisma.userPreferences.update({
    where: { userId },
    data: { shippingPref: { ...existing, cardLinkedOffers: offers } },
  });

  await recordAuditEvent({
    userId,
    action: 'profile.card_offers_updated',
    entityType: 'user_preferences',
    entityId: preferences.id,
    summary: `Updated ${offers.length} card-linked offer(s)`,
    metadata: { count: offers.length },
  });

  return res.json({ offers });
}
