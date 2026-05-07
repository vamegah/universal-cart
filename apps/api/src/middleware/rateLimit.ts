import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from './auth';
import { logger } from '../utils/logger';

// ─── in-process fallback store ────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };
const localBuckets = new Map<string, Bucket>();

function localIncr(key: string, windowMs: number): { count: number; ttlMs: number } {
  const now = Date.now();
  const bucket = localBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, ttlMs: windowMs };
  }
  bucket.count += 1;
  return { count: bucket.count, ttlMs: bucket.resetAt - now };
}

// ─── Redis client (lazy, shared) ──────────────────────────────────────────────

let redisClient: any = null;
let redisConnecting = false;
let redisAvailable = false;

async function getRedis(): Promise<any | null> {
  if (!process.env.REDIS_URL) return null;
  if (redisAvailable && redisClient) return redisClient;
  if (redisConnecting) return null; // still connecting — fall back to local

  redisConnecting = true;
  try {
    // Runtime import so the API starts without ioredis installed in dev.
    const Redis = require('ioredis');
    const client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });
    await client.connect();
    client.on('error', (err: Error) => {
      logger.warn(`Redis rate-limit client error: ${err.message} — falling back to in-process store`);
      redisAvailable = false;
    });
    client.on('ready', () => { redisAvailable = true; });
    redisClient = client;
    redisAvailable = true;
    logger.info('Rate-limit Redis client connected');
    return client;
  } catch (error: any) {
    logger.warn(`Redis unavailable for rate limiting (${error?.message}) — using in-process store`);
    redisAvailable = false;
    return null;
  } finally {
    redisConnecting = false;
  }
}

// ─── Redis increment with sliding fixed window ────────────────────────────────

async function redisIncr(
  redis: any,
  key: string,
  windowMs: number
): Promise<{ count: number; ttlMs: number }> {
  const windowSec = Math.ceil(windowMs / 1000);
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.pttl(key);
  const [[, count], [, pttl]] = await pipeline.exec();

  // Set expiry only on first request in the window.
  if (count === 1) {
    await redis.expire(key, windowSec);
    return { count: 1, ttlMs: windowMs };
  }
  return { count, ttlMs: pttl > 0 ? pttl : windowMs };
}

// ─── admin bypass ─────────────────────────────────────────────────────────────

function isAdminEmail(email: string | undefined): boolean {
  if (!email || !process.env.ADMIN_EMAILS) return false;
  return process.env.ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());
}

// ─── client key ───────────────────────────────────────────────────────────────

function getClientKey(req: Request, scope: string): string {
  const userId = (req as Partial<AuthenticatedRequest>).userId;
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip =
    typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0].trim()
      : req.ip || req.socket?.remoteAddress || 'unknown';
  return `rl:${scope}:${userId || ip}`;
}

// ─── middleware factory ───────────────────────────────────────────────────────

export function rateLimit(scope: string, limit: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Admin bypass — admins are never rate-limited.
    const userEmail = (req as any).userEmail as string | undefined;
    if (isAdminEmail(userEmail)) return next();

    const key = getClientKey(req, scope);
    let count: number;
    let ttlMs: number;

    try {
      const redis = await getRedis();
      if (redis) {
        ({ count, ttlMs } = await redisIncr(redis, key, windowMs));
      } else {
        ({ count, ttlMs } = localIncr(key, windowMs));
      }
    } catch (error: any) {
      // If the store errors, fail open to avoid blocking legitimate traffic.
      logger.warn(`Rate-limit store error for ${scope}: ${error?.message} — allowing request`);
      return next();
    }

    const remaining = Math.max(0, limit - count);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));

    if (count > limit) {
      const retryAfterSeconds = Math.ceil(ttlMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('RateLimit-Remaining', '0');
      return res.status(429).json({ error: 'Too many requests', retryAfterSeconds });
    }

    return next();
  };
}
