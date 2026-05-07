import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { listAuditEvents } from '../services/auditService';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const limit = Number(req.query.limit || 50);
  const events = await listAuditEvents(userId, Number.isFinite(limit) ? limit : 50);
  return res.json({ events });
});

export default router;
