import { prisma } from '../index';
import { logger } from '../utils/logger';

type AuditMetadata = Record<string, unknown> | null | undefined;

const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'passwordHash',
  'cardToken',
  'token',
  'authToken',
  'cardNumber',
  'cvv',
  'cvc',
  'pan',
]);

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key)) return '[redacted]';
  if (Array.isArray(value)) return value.map((entry) => sanitizeObject(entry));
  if (value && typeof value === 'object') return sanitizeObject(value);
  return value;
}

export function sanitizeObject(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return Array.isArray(value) ? value.map((entry) => sanitizeObject(entry)) : value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sanitizeValue(key, entry),
    ])
  );
}

export async function recordAuditEvent(input: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: AuditMetadata;
}) {
  try {
    return await prisma.auditEvent.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        summary: input.summary,
        metadata: input.metadata ? (sanitizeObject(input.metadata) as any) : undefined,
      },
    });
  } catch (error) {
    logger.error(`Failed to record audit event ${input.action}: ${error}`);
    return null;
  }
}

export async function listAuditEvents(userId: string, limit = 50) {
  return prisma.auditEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 100),
  });
}
