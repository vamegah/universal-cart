import { Router } from 'express';
import {
  addSavedListItem,
  acceptSavedListInvite,
  createSavedList,
  deleteSavedList,
  getSavedList,
  inviteSavedList,
  listSavedLists,
  renameSavedList,
  removeSavedListItem,
  removeSavedListShare,
  restoreSavedListToCart,
  saveActiveCartAsList,
  shareSavedList,
  updateSavedListItem,
} from '../controllers/listController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('lists', 60, 60 * 1000));
router.get('/', listSavedLists);
router.post('/', createSavedList);
router.post('/from-cart', saveActiveCartAsList);
router.post('/accept-invite', acceptSavedListInvite);
router.get('/:id', getSavedList);
router.post('/:id/restore', restoreSavedListToCart);
router.post('/:id/share', shareSavedList);
router.post('/:id/invite', inviteSavedList);
router.delete('/:id/share/:shareId', removeSavedListShare);
router.put('/:id', renameSavedList);
router.delete('/:id', deleteSavedList);
router.post('/:id/items', addSavedListItem);
router.patch('/:id/items/:itemId', updateSavedListItem);
router.delete('/:id/items/:itemId', removeSavedListItem);

export default router;
