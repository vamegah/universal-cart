import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { getUserAnalytics } from '../services/analyticsService';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('analytics', 60, 60 * 1000));

router.get('/', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const analytics = await getUserAnalytics(userId);
  return res.json(analytics);
});

export default router;
