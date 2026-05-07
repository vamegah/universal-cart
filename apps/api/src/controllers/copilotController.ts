import { Request, Response } from 'express';
import { getSupportedRetailerNames } from '../integrations/registry';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../index';
import { recordAuditEvent } from '../services/auditService';
import { buildShoppingCopilotRecommendation } from '../services/shoppingCopilotService';
import { logger } from '../utils/logger';

async function userContext(userId: string) {
  const [cards, preferences] = await Promise.all([
    prisma.userCard.findMany({
      where: { userId },
      select: { retailerName: true, cardLast4: true },
    }),
    prisma.userPreferences.findUnique({ where: { userId } }),
  ]);

  return {
    supportedStores: getSupportedRetailerNames(),
    userCards: cards,
    preferences,
  };
}

export async function recommendCopilotActions(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { command, items, userStores, shippingThresholds } = req.body || {};
  if (!command || !Array.isArray(items)) {
    return res.status(400).json({ error: 'command and items are required' });
  }

  try {
    const recommendation = buildShoppingCopilotRecommendation({
      command,
      items,
      userStores,
      shippingThresholds,
      context: await userContext(userId),
    });

    await recordAuditEvent({
      userId,
      action: recommendation.audit.action,
      entityType: 'shopping_copilot',
      summary: 'Shopping copilot generated pending cart recommendations',
      metadata: {
        command: recommendation.command,
        intent: recommendation.intent,
        targetStores: recommendation.targetStores,
        pendingCount: recommendation.summary.pendingCount,
        blockedCount: recommendation.summary.blockedCount,
        recommendationCount: recommendation.audit.recommendationCount,
        requiresConfirmation: recommendation.requiresConfirmation,
      },
    });

    return res.json(recommendation);
  } catch (error) {
    logger.error(`Shopping copilot error: ${error}`);
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to build recommendations' });
  }
}
