import { Router } from 'express';
import { addCard, deleteCard, getProfile, upsertPreferences, upsertCardLinkedOffers } from '../controllers/profileController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', getProfile);
router.put('/preferences', upsertPreferences);
router.post('/cards', addCard);
router.delete('/cards/:id', deleteCard);
router.put('/card-offers', upsertCardLinkedOffers);

export default router;
