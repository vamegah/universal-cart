import crypto from 'crypto';
import { prisma } from '../index';
import { createAuthToken } from '../middleware/auth';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function hashSessionToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getSessionExpiry(now = Date.now()) {
  return new Date(now + SESSION_TTL_MS);
}

export async function createUserSessionToken(
  userId: string,
  context: { userAgent?: string | null; ipAddress?: string | null } = {}
) {
  const sessionId = crypto.randomUUID();
  const expiresAt = getSessionExpiry();
  const { token, tokenId } = createAuthToken(userId, undefined, { sessionId, expiresAt });

  await (prisma as any).userSession.create({
    data: {
      id: sessionId,
      userId,
      tokenHash: hashSessionToken(token),
      tokenId,
      userAgent: context.userAgent || null,
      ipAddress: context.ipAddress || null,
      expiresAt,
    },
  });

  return { token, sessionId, expiresAt };
}

export async function rotateUserSessionToken(
  userId: string,
  sessionId: string | undefined,
  context: { userAgent?: string | null; ipAddress?: string | null } = {}
) {
  if (!sessionId) {
    return createUserSessionToken(userId, context);
  }

  const expiresAt = getSessionExpiry();
  const { token, tokenId } = createAuthToken(userId, undefined, { sessionId, expiresAt });

  await (prisma as any).userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: {
      tokenHash: hashSessionToken(token),
      tokenId,
      userAgent: context.userAgent || null,
      ipAddress: context.ipAddress || null,
      expiresAt,
    },
  });

  return { token, sessionId, expiresAt };
}

export async function revokeUserSession(userId: string, sessionId: string | undefined) {
  if (!sessionId) return { count: 0 };
  return (prisma as any).userSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
