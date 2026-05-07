import { Request, Response } from 'express';
import { findMatchForProduct, saveMatchCandidates, selectMatch } from '../services/matchingService';
import { buildSmartMatchAssistant } from '../services/matchAssistantService';
import { getRetailerDefinitionByName, getSupportedRetailerNames } from '../integrations/registry';
import { AuthenticatedRequest } from '../middleware/auth';
import { getCartItemForUser } from '../services/cartService';
import { recordAuditEvent } from '../services/auditService';
import { logger } from '../utils/logger';

export async function matchProduct(req: Request, res: Response) {
  const { userId } = req as AuthenticatedRequest;
  const { product, preferredStore } = req.body;
  if (!product || !preferredStore) {
    return res.status(400).json({ error: 'product and preferredStore are required' });
  }

  const retailerDefinition = getRetailerDefinitionByName(preferredStore);
  if (!retailerDefinition) {
    return res.status(422).json({
      error: 'Preferred store is not supported',
      supportedStores: getSupportedRetailerNames(),
    });
  }

  try {
    const match = await findMatchForProduct(product, retailerDefinition.name);
    if (!match) {
      await recordAuditEvent({
        userId,
        action: 'match.not_found',
        entityType: 'product',
        entityId: product.id || product.productId || null,
        summary: `No match found at ${retailerDefinition.name}`,
        metadata: {
          preferredStore: retailerDefinition.name,
          productName: product.name || product.productName,
        },
      });
      return res.status(404).json({ message: 'No match found' });
    }
    await recordAuditEvent({
      userId,
      action: 'match.generated',
      entityType: 'product',
      entityId: product.id || product.productId || null,
      summary: `Matched ${product.name || product.productName || 'product'} at ${retailerDefinition.name}`,
      metadata: {
        preferredStore: retailerDefinition.name,
        matchType: match.matchType,
        confidence: match.confidence,
        retailerProductId: match.retailerProduct?.id,
        reason: match.reason,
      },
    });
    return res.json({
      ...match,
      assistant: buildSmartMatchAssistant(product, match),
    });
  } catch (error) {
    logger.error(`Match error: ${error}`);
    return res.status(500).json({ error: 'Match operation failed' });
  }
}

export async function explainMatch(req: Request, res: Response) {
  const { product, match } = req.body || {};
  if (!product) {
    return res.status(400).json({ error: 'product is required' });
  }

  return res.json({ assistant: buildSmartMatchAssistant(product, match || null) });
}

export async function saveSelectedMatch(req: Request, res: Response) {
  const { cartItemId, retailerProductId, matchType, confidence } = req.body;
  if (!cartItemId || !retailerProductId || !matchType) {
    return res.status(400).json({ error: 'cartItemId, retailerProductId, and matchType are required' });
  }

  const { userId } = req as AuthenticatedRequest;
  const cartItem = await getCartItemForUser(userId, cartItemId);
  if (!cartItem) {
    return res.status(404).json({ error: 'Cart item not found or does not belong to the authenticated user' });
  }

  try {
    const result = await selectMatch(cartItemId, retailerProductId, matchType, confidence ?? 0);
    await recordAuditEvent({
      userId,
      action: 'match.selected',
      entityType: 'cart_item',
      entityId: cartItemId,
      summary: `Selected ${matchType} match for cart item`,
      metadata: {
        retailerProductId,
        matchType,
        confidence: confidence ?? 0,
      },
    });
    return res.json(result);
  } catch (error) {
    logger.error(`Save match error: ${error}`);
    return res.status(500).json({ error: 'Could not save match selection' });
  }
}

export async function saveMatchCandidateSet(req: Request, res: Response) {
  const { cartItemId, candidates, selectedRetailerProductId } = req.body;
  if (!cartItemId || !Array.isArray(candidates)) {
    return res.status(400).json({ error: 'cartItemId and candidates are required' });
  }

  const { userId } = req as AuthenticatedRequest;
  const cartItem = await getCartItemForUser(userId, cartItemId);
  if (!cartItem) {
    return res.status(404).json({ error: 'Cart item not found or does not belong to the authenticated user' });
  }

  try {
    const result = await saveMatchCandidates(cartItemId, candidates, selectedRetailerProductId);
    await recordAuditEvent({
      userId,
      action: 'match.candidates_saved',
      entityType: 'cart_item',
      entityId: cartItemId,
      summary: `Saved ${candidates.length} match candidate${candidates.length === 1 ? '' : 's'}`,
      metadata: {
        candidateCount: candidates.length,
        selectedRetailerProductId,
        candidates: candidates.map((candidate: any) => ({
          retailerProductId: candidate.retailerProductId,
          matchType: candidate.matchType,
          confidence: candidate.confidence,
          reason: candidate.reason,
        })),
      },
    });
    return res.json(result);
  } catch (error) {
    logger.error(`Save match candidates error: ${error}`);
    return res.status(500).json({ error: 'Could not save match candidates' });
  }
}
