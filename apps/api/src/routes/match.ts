import { Router } from 'express';
import { explainMatch, matchProduct, saveSelectedMatch, saveMatchCandidateSet } from '../controllers/matchController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
router.use(requireAuth);
router.use(rateLimit('match', 120, 60 * 1000));
router.post('/', matchProduct);
router.post('/assistant', explainMatch);
router.post('/select', saveSelectedMatch);
router.post('/candidates', saveMatchCandidateSet);

export default router;
