import { Router } from 'express';
import {
  getBundleSuggestions,
  getLatestSplitPlan,
  getSplitPlanSuggestions,
  optimizeCart,
  optimizeCartGlobal,
} from '../controllers/optimizeController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
router.use(requireAuth);
router.use(rateLimit('optimize', 60, 60 * 1000));
router.post('/', optimizeCart);
router.post('/global', optimizeCartGlobal);
router.get('/:cartId/latest', getLatestSplitPlan);
router.get('/:cartId/suggestions', getSplitPlanSuggestions);
router.get('/:cartId/bundles', getBundleSuggestions);

export default router;
