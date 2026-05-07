import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../index';

export interface AuthenticatedRequest extends Request {
  userId: string;
  sessionId?: string;
  tokenId?: string;
  authToken?: string;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAuthToken(
  userId: string,
  secret = process.env.AUTH_SECRET || 'dev-auth-secret',
  options: { sessionId?: string; expiresAt?: Date } = {}
) {
  const tokenId = crypto.randomBytes(16).toString('base64url');
  const payload = base64Url(JSON.stringify({
    sub: userId,
    iat: Date.now(),
    exp: options.expiresAt?.getTime() ?? Date.now() + 1000 * 60 * 60 * 24 * 7,
    jti: tokenId,
    sid: options.sessionId,
  }));
  return { token: `${payload}.${sign(payload, secret)}`, tokenId };
}

function verifyAuthToken(token: string, secret = process.env.AUTH_SECRET || 'dev-auth-secret') {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return typeof parsed.sub === 'string'
      ? {
          userId: parsed.sub,
          sessionId: typeof parsed.sid === 'string' ? parsed.sid : undefined,
          tokenId: typeof parsed.jti === 'string' ? parsed.jti : undefined,
        }
      : null;
  } catch {
    return null;
  }
}

function hashBearerToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  const auth = bearerToken ? verifyAuthToken(bearerToken) : null;

  if (!auth?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid authenticated user' });
  }

  if (auth.sessionId) {
    const session = await (prisma as any).userSession.findFirst({
      where: {
        id: auth.sessionId,
        userId: user.id,
        tokenHash: hashBearerToken(bearerToken!),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!session) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }
  }

  (req as AuthenticatedRequest).userId = user.id;
  (req as AuthenticatedRequest).sessionId = auth.sessionId;
  (req as AuthenticatedRequest).tokenId = auth.tokenId;
  (req as AuthenticatedRequest).authToken = bearerToken || undefined;
  return next();
}
