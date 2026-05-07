import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { exportUserData, deleteUserData } from '../services/privacyService';
import { recordAuditEvent } from '../services/auditService';

const router = Router();

router.use(requireAuth);

router.get('/export', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  await recordAuditEvent({
    userId,
    action: 'privacy.export_requested',
    entityType: 'user',
    entityId: userId,
    summary: 'Requested account data export',
  });

  const data = await exportUserData(userId);
  return res.json(data);
});

router.delete('/account', async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const confirmation = String(req.body?.confirmation || '');

  if (confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'confirmation must be DELETE' });
  }

  await deleteUserData(userId);
  return res.json({ deleted: true });
});

export default router;
