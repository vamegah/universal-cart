import { Router } from 'express';
import {
  getCheckoutRedirectUrl,
  getCheckoutFinancingOptions,
  getCheckoutStores,
  getCheckoutStoreStatuses,
  validateCheckoutReadiness,
} from '../controllers/checkoutController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
router.use(requireAuth);
router.use(rateLimit('checkout', 60, 60 * 1000));
router.get('/financing-options', getCheckoutFinancingOptions);
router.get('/stores', getCheckoutStores);
router.post('/stores', getCheckoutStoreStatuses);
router.post('/validate', validateCheckoutReadiness);
router.post('/redirect', getCheckoutRedirectUrl);

export default router;
