import { Router } from 'express';
import { checkoutWithCard, issueCard, providerStatus } from '../controllers/virtualCardController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('virtualcards', 20, 60 * 1000));
router.get('/provider-status', providerStatus);
router.post('/issue', issueCard);
router.post('/checkout', checkoutWithCard);

export default router;
