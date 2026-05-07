import { Router } from 'express';
import { recommendCopilotActions } from '../controllers/copilotController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('copilot', 60, 60 * 1000));
router.post('/recommend', recommendCopilotActions);

export default router;
