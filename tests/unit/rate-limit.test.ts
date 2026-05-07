import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { rateLimit } from '../../apps/api/src/middleware/rateLimit';

function createResponse() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: undefined as any,
    setHeader(key: string, value: string) { headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    headers,
  };
}

function makeReq(overrides: Record<string, any> = {}) {
  return {
    ip: '127.0.0.1',
    headers: {},
    socket: {},
    userId: 'user-a',
    ...overrides,
  } as any;
}

describe('rateLimit middleware — in-process fallback (no REDIS_URL)', () => {
  beforeEach(() => { delete process.env.REDIS_URL; });

  it('allows requests up to the limit and blocks the next one', async () => {
    const middleware = rateLimit('unit-basic', 2, 60_000);
    const req = makeReq({ userId: `u-${Date.now()}` });
    const next = jest.fn();

    const r1 = createResponse();
    const r2 = createResponse();
    const r3 = createResponse();

    await middleware(req, r1 as any, next);
    await middleware(req, r2 as any, next);
    await middleware(req, r3 as any, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(r3.statusCode).toBe(429);
    expect(r3.body.error).toBe('Too many requests');
    expect(r3.headers['RateLimit-Remaining']).toBe('0');
  });

  it('sets RateLimit-Limit and RateLimit-Remaining headers', async () => {
    const middleware = rateLimit('unit-headers', 5, 60_000);
    const req = makeReq({ userId: `u-${Date.now()}` });
    const next = jest.fn();
    const res = createResponse();

    await middleware(req, res as any, next);

    expect(res.headers['RateLimit-Limit']).toBe('5');
    expect(res.headers['RateLimit-Remaining']).toBe('4');
  });

  it('tracks different users independently', async () => {
    const middleware = rateLimit('unit-users', 1, 60_000);
    const nextA = jest.fn();
    const nextB = jest.fn();
    const reqA = makeReq({ userId: `ua-${Date.now()}` });
    const reqB = makeReq({ userId: `ub-${Date.now()}` });

    await middleware(reqA, createResponse() as any, nextA);
    await middleware(reqA, createResponse() as any, nextA);
    await middleware(reqB, createResponse() as any, nextB);

    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).toHaveBeenCalledTimes(1);
  });

  it('falls back to IP when no userId is present', async () => {
    const middleware = rateLimit('unit-ip', 1, 60_000);
    const req = makeReq({ userId: undefined, ip: `10.0.0.${Date.now() % 255}` });
    const next = jest.fn();

    await middleware(req, createResponse() as any, next);
    await middleware(req, createResponse() as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('rateLimit middleware — admin bypass', () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
    process.env.ADMIN_EMAILS = 'admin@example.com,ops@example.com';
  });
  afterEach(() => { delete process.env.ADMIN_EMAILS; });

  it('never blocks an admin email regardless of request count', async () => {
    const middleware = rateLimit('unit-admin', 1, 60_000);
    const req = makeReq({ userId: `admin-${Date.now()}`, userEmail: 'admin@example.com' });
    const next = jest.fn();

    for (let i = 0; i < 5; i++) {
      await middleware(req, createResponse() as any, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
  });

  it('does not bypass for non-admin emails', async () => {
    const middleware = rateLimit('unit-nonadmin', 1, 60_000);
    const req = makeReq({ userId: `user-${Date.now()}`, userEmail: 'user@example.com' });
    const next = jest.fn();

    await middleware(req, createResponse() as any, next);
    const r2 = createResponse();
    await middleware(req, r2 as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(r2.statusCode).toBe(429);
  });
});

describe('rateLimit middleware — fail open on store error', () => {
  beforeEach(() => {
    // Point at a Redis URL that will fail to connect.
    process.env.REDIS_URL = 'redis://127.0.0.1:19999';
  });
  afterEach(() => { delete process.env.REDIS_URL; });

  it('allows the request through when the store is unavailable', async () => {
    const middleware = rateLimit('unit-failopen', 1, 60_000);
    const req = makeReq({ userId: `fo-${Date.now()}` });
    const next = jest.fn();

    // Even though REDIS_URL is set, the connection will fail and the middleware
    // should fall back gracefully (either to local store or fail-open).
    const res = createResponse();
    await middleware(req, res as any, next);

    // Request must not be blocked due to a store error.
    expect(res.statusCode).not.toBe(429);
  });
});
