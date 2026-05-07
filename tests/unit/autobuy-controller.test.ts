/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFindFirst = jest.fn<(args: any) => Promise<any>>();
const mockUpdate = jest.fn<(args: any) => Promise<any>>();
const mockDelete = jest.fn<(args: any) => Promise<any>>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    autoBuyRule: {
      findFirst: mockFindFirst,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

import { deleteAutoBuyRule, updateAutoBuyRule } from '../../apps/api/src/controllers/autobuyController';

function safeTrigger(overrides: Record<string, unknown> = {}) {
  return {
    type: 'time_window',
    userConsentAccepted: true,
    maxSpendAmount: 100,
    confirmationPolicy: 'auto_execute',
    cancellationWindowMinutes: 0,
    ...overrides,
  };
}

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

describe('autobuyController rule management', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  it('updates an owned auto-buy rule', async () => {
    mockFindFirst.mockResolvedValue({ id: 'rule-1', userId: 'user-1' });
    mockUpdate.mockResolvedValue({
      id: 'rule-1',
      trigger: { type: 'time_window' },
      status: 'paused',
    });
    const res = response();

    await updateAutoBuyRule(
      {
        params: { id: 'rule-1' },
        body: { trigger: JSON.stringify(safeTrigger()), status: 'paused', executionCardId: '' },
        userId: 'user-1',
      } as any,
      res as any
    );

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { id: 'rule-1', userId: 'user-1' } });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: {
        trigger: safeTrigger(),
        status: 'paused',
        executionCardId: null,
      },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'rule-1' }));
  });

  it('rejects invalid update status', async () => {
    mockFindFirst.mockResolvedValue({ id: 'rule-1', userId: 'user-1' });
    const res = response();

    await updateAutoBuyRule(
      {
        params: { id: 'rule-1' },
        body: { status: 'finished' },
        userId: 'user-1',
      } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects unsafe trigger updates without explicit consent', async () => {
    mockFindFirst.mockResolvedValue({ id: 'rule-1', userId: 'user-1' });
    const res = response();

    await updateAutoBuyRule(
      {
        params: { id: 'rule-1' },
        body: { trigger: { type: 'total_price_below', value: 50 } },
        userId: 'user-1',
      } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Auto-buy requires explicit userConsentAccepted consent' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('deletes an owned auto-buy rule', async () => {
    mockFindFirst.mockResolvedValue({ id: 'rule-1', userId: 'user-1' });
    mockDelete.mockResolvedValue({ id: 'rule-1' });
    const res = response();

    await deleteAutoBuyRule(
      {
        params: { id: 'rule-1' },
        userId: 'user-1',
      } as any,
      res as any
    );

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
});
