import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { rateLimit } from '../middleware/rateLimit';
import { getRetailerIntegrationOverview, updateRetailerIntegrationConfig } from '../services/adminRetailerService';
import { adminRejectMatch, adminSelectMatch, getMatchReviewQueue } from '../services/adminMatchingService';
import { getSellerTrustReviewQueue, updateSellerTrustListing } from '../services/adminSellerTrustService';
import { getGlobalAnalytics } from '../services/analyticsService';
import { AuthenticatedRequest } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);
router.use(rateLimit('admin', 60, 60 * 1000));

router.get('/retailers', async (_req, res) => {
  const overview = await getRetailerIntegrationOverview();
  return res.json(overview);
});

router.patch('/retailers/:retailerName', async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { retailerName } = req.params;

  try {
    const config = await updateRetailerIntegrationConfig(retailerName, req.body || {});
    await recordAuditEvent({
      userId,
      action: 'admin.retailer_config_updated',
      entityType: 'retailer_integration',
      entityId: config.retailerName,
      summary: `Admin updated ${config.retailerName} integration configuration`,
      metadata: {
        pricingRefreshCadence: config.pricingRefreshCadence,
        catalogIngestionStatus: config.catalogIngestionStatus,
        affiliateMode: config.affiliateMode,
        partnershipStatus: config.partnershipStatus,
      },
    });
    return res.json({ config });
  } catch (error: any) {
    const status = error.message?.includes('Unsupported retailer') ? 404 : error.message?.includes('must be one of') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Unable to update retailer integration configuration' });
  }
});

router.get('/matches', async (req, res) => {
  const limit = Number(req.query.limit || 50);
  const queue = await getMatchReviewQueue(Number.isFinite(limit) ? limit : 50);
  return res.json(queue);
});

router.get('/analytics', async (_req, res) => {
  const analytics = await getGlobalAnalytics();
  return res.json(analytics);
});

router.get('/seller-trust', async (req, res) => {
  const limit = Number(req.query.limit || 50);
  const queue = await getSellerTrustReviewQueue(Number.isFinite(limit) ? limit : 50);
  return res.json(queue);
});

router.patch('/seller-trust/:retailerProductId', async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { retailerProductId } = req.params;

  try {
    const listing = await updateSellerTrustListing(retailerProductId, req.body);
    await recordAuditEvent({
      userId,
      action: 'admin.seller_trust_updated',
      entityType: 'retailer_product',
      entityId: retailerProductId,
      summary: 'Admin updated seller trust signals',
      metadata: {
        sellerName: listing.sellerName,
        isAuthorizedSeller: listing.isAuthorizedSeller,
        counterfeitRisk: listing.counterfeitRisk,
        trustScore: listing.trust.score,
      },
    });
    return res.json({ listing });
  } catch (error: any) {
    const status = error.code === 'P2025' ? 404 : error.message?.includes('counterfeitRisk') ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Unable to update seller trust listing' });
  }
});

router.post('/matches/:cartItemId/select', async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { cartItemId } = req.params;
  const { retailerProductId, matchType = 'exact', confidence = 0.99 } = req.body;

  if (!retailerProductId) {
    return res.status(400).json({ error: 'retailerProductId is required' });
  }

  try {
    const match = await adminSelectMatch(cartItemId, retailerProductId, matchType, Number(confidence));
    await recordAuditEvent({
      userId,
      action: 'admin.match_selected',
      entityType: 'cart_item',
      entityId: cartItemId,
      summary: 'Admin selected match for cart item',
      metadata: { retailerProductId, matchType, confidence },
    });
    return res.json({ match });
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: error.message || 'Unable to select match' });
  }
});

router.post('/matches/:matchId/reject', async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { matchId } = req.params;
  const blacklistListing = req.body?.blacklistListing === true;

  try {
    const result = await adminRejectMatch(matchId, blacklistListing);
    await recordAuditEvent({
      userId,
      action: 'admin.match_rejected',
      entityType: 'match_result',
      entityId: matchId,
      summary: blacklistListing ? 'Admin rejected match and blacklisted listing' : 'Admin rejected match candidate',
      metadata: {
        blacklistListing,
        blacklistedRetailerProductId: result.blacklistedRetailerProductId,
      },
    });
    return res.json(result);
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500;
    return res.status(status).json({ error: error.message || 'Unable to reject match' });
  }
});

export default router;
