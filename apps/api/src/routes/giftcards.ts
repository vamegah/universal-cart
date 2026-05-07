import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { listGiftCards, purchaseGiftCard } from '../controllers/giftCardController';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('giftcards', 10, 60 * 1000));
router.get('/', listGiftCards);
router.post('/purchase', purchaseGiftCard);

export default router;
