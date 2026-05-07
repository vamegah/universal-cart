import { Router } from 'express';
import {
  createAutoBuyRule,
  deleteAutoBuyRule,
  listAutoBuyRules,
  updateAutoBuyRule,
} from '../controllers/autobuyController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('autobuy', 30, 60 * 1000));
router.get('/', listAutoBuyRules);
router.post('/', createAutoBuyRule);
router.patch('/:id', updateAutoBuyRule);
router.delete('/:id', deleteAutoBuyRule);

export default router;
