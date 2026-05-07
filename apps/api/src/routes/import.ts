import { Router } from 'express';
import { importProduct, searchProducts } from '../controllers/importController';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
router.use(requireAuth);
router.use(rateLimit('import', 30, 60 * 1000));
router.post('/url', importProduct);
router.post('/search', searchProducts);
export default router;
