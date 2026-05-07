import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const createSession = jest.fn<(args: any) => Promise<any>>();
const updateManySession = jest.fn<(args: any) => Promise<any>>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    userSession: {
      create: createSession,
      updateMany: updateManySession,
    },
  },
}));

import { createUserSessionToken, hashSessionToken, revokeUserSession, rotateUserSessionToken } from '../../apps/api/src/services/sessionService';

describe('sessionService', () => {
  beforeEach(() => {
    createSession.mockReset();
    updateManySession.mockReset();
    createSession.mockResolvedValue({});
    updateManySession.mockResolvedValue({ count: 1 });
  });

  it('creates a persisted user session without storing the bearer token', async () => {
    const session = await createUserSessionToken('user-1', {
      userAgent: 'Unit Test Browser',
      ipAddress: '127.0.0.1',
    });

    expect(session.token).toContain('.');
    expect(session.sessionId).toBeTruthy();
    expect(createSession).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: session.sessionId,
        userId: 'user-1',
        userAgent: 'Unit Test Browser',
        ipAddress: '127.0.0.1',
        tokenHash: hashSessionToken(session.token),
        tokenId: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(createSession.mock.calls[0][0].data.tokenHash).not.toBe(session.token);
  });

  it('rotates an existing session token hash for refresh', async () => {
    const session = await rotateUserSessionToken('user-1', 'session-1');

    expect(updateManySession).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1', revokedAt: null },
      data: expect.objectContaining({
        tokenHash: hashSessionToken(session.token),
        tokenId: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it('revokes only the current active user session on logout', async () => {
    await revokeUserSession('user-1', 'session-1');

    expect(updateManySession).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
