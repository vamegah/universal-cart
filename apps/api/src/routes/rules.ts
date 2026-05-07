import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { parseNaturalLanguageCartRules } from '../services/cartRulesService';

const router = Router();

router.use(requireAuth);
router.use(rateLimit('rules', 60, 60 * 1000));

router.post('/parse', (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text is required' });
  return res.json({ rules: parseNaturalLanguageCartRules(text) });
});

export default router;
