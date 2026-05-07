import { Router } from 'express';
import {
  createAlertSubscription,
  deleteAlertSubscription,
  listAlertSubscriptions,
  updateAlertSubscription,
} from '../controllers/alertController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('alerts', 60, 60 * 1000));
router.get('/', listAlertSubscriptions);
router.post('/', createAlertSubscription);
router.patch('/:id', updateAlertSubscription);
router.delete('/:id', deleteAlertSubscription);

export default router;
