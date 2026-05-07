import { Router } from 'express';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { prisma } from '../index';
import { hashPassword, verifyPassword } from '../services/passwordService';
import { createUserSessionToken, revokeUserSession, rotateUserSessionToken } from '../services/sessionService';

const router = Router();

function publicUser(user: { id: string; email: string; createdAt: Date }) {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function sessionContext(req: any) {
  return {
    userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    ipAddress: req.ip || req.socket?.remoteAddress || null,
  };
}

async function authResponse(user: { id: string; email: string; createdAt: Date }, req: any) {
  const session = await createUserSessionToken(user.id, sessionContext(req));
  return {
    token: session.token,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    user: publicUser(user),
  };
}

router.post('/signup', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !email.includes('@') || password.length < 8) {
    return res.status(400).json({ error: 'Valid email and password with at least 8 characters are required' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
    },
  });

  return res.status(201).json(await authResponse(user, req));
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  return res.json(await authResponse(user, req));
});

router.get('/me', requireAuth, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return res.json({ user: publicUser(user) });
});

router.post('/refresh', requireAuth, async (req, res) => {
  const { userId, sessionId } = req as AuthenticatedRequest;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const session = await rotateUserSessionToken(userId, sessionId, sessionContext(req));
  return res.json({
    token: session.token,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
    user: publicUser(user),
  });
});

router.post('/logout', requireAuth, async (req, res) => {
  const { userId, sessionId } = req as AuthenticatedRequest;
  await revokeUserSession(userId, sessionId);
  return res.status(204).send();
});

router.post('/dev-token', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const { userId = 'test-user', email = 'test-user@example.com' } = req.body || {};

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: { email },
    create: {
      id: userId,
      email,
      passwordHash: 'dev-only',
    },
  });

  const session = await createUserSessionToken(user.id, sessionContext(req));
  return res.json({ token: session.token, sessionId: session.sessionId, userId: user.id });
});

export default router;
