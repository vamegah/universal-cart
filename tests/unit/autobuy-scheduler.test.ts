/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFindMany = jest.fn<() => Promise<any[]>>();
const mockUpdate = jest.fn<(args: any) => Promise<any>>();
const mockCheckoutWithVirtualCard = jest.fn<() => Promise<any>>();
const mockRecordAuditEvent = jest.fn<() => Promise<void>>();

jest.mock('../../apps/api/src/index', () => ({
  prisma: {
    autoBuyRule: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}));

jest.mock('../../apps/api/src/services/virtualCardService', () => ({
  checkoutWithVirtualCard: mockCheckoutWithVirtualCard,
}));

jest.mock('../../apps/api/src/services/auditService', () => ({
  recordAuditEvent: mockRecordAuditEvent,
}));

jest.mock('../../apps/api/src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { evaluateAutoBuyRules, shouldTriggerAutoBuy } from '../../apps/api/src/services/autoBuyScheduler';

const originalMockPayments = process.env.ENABLE_MOCK_PAYMENTS;

function safeTrigger(trigger: any) {
  return {
    userConsentAccepted: true,
    maxSpendAmount: 100,
    confirmationPolicy: 'auto_execute',
    cancellationWindowMinutes: 0,
    approvedAt: '2026-05-01T00:00:00.000Z',
    ...trigger,
  };
}

function ruleFixture(trigger: any, overrides: Record<string, any> = {}) {
  return {
    id: 'rule-1',
    trigger,
    executionCardId: 'card-1',
    user: { id: 'user-1' },
    cart: {
      id: 'cart-1',
      items: [
        {
          id: 'item-1',
          quantity: 2,
          matchResults: [
            {
              isSelected: true,
              retailerProduct: {
                id: 'rp-1',
                retailerName: 'Target',
                price: 20,
                inStock: true,
              },
            },
          ],
        },
      ],
    },
    ...overrides,
  };
}

describe('autoBuyScheduler trigger evaluation', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockCheckoutWithVirtualCard.mockReset();
    mockRecordAuditEvent.mockReset();
    process.env.ENABLE_MOCK_PAYMENTS = 'true';
    mockUpdate.mockResolvedValue({});
    mockCheckoutWithVirtualCard.mockResolvedValue({ success: true });
    mockRecordAuditEvent.mockResolvedValue();
  });

  afterEach(() => {
    if (originalMockPayments === undefined) {
      delete process.env.ENABLE_MOCK_PAYMENTS;
    } else {
      process.env.ENABLE_MOCK_PAYMENTS = originalMockPayments;
    }
  });

  it('fires total_price_below rules when the selected cart total is at or below the threshold', async () => {
    mockFindMany.mockResolvedValue([ruleFixture(safeTrigger({ type: 'total_price_below', value: 40 }))]);

    await evaluateAutoBuyRules();

    expect(mockCheckoutWithVirtualCard).toHaveBeenCalledWith('cart-1', 'user-1', 'card-1');
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { status: 'executed', executedAt: expect.any(Date) },
    });
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'autobuy.executed',
      entityId: 'rule-1',
    }));
  });

  it('skips total_price_below rules when cart total is above threshold', async () => {
    mockFindMany.mockResolvedValue([ruleFixture(safeTrigger({ type: 'total_price_below', value: 39.99 }))]);

    await evaluateAutoBuyRules();

    expect(mockCheckoutWithVirtualCard).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('fires inventory_threshold rules on a false-to-true stock transition below max stock', () => {
    const evaluation = shouldTriggerAutoBuy(
      ruleFixture({
        userConsentAccepted: true,
        maxSpendAmount: 100,
        confirmationPolicy: 'auto_execute',
        cancellationWindowMinutes: 0,
        type: 'inventory_threshold',
        retailerName: 'Target',
        previousInStock: false,
        currentStock: 2,
        maxStock: 3,
      })
    );

    expect(evaluation).toMatchObject({
      triggered: true,
      reason: 'inventory_threshold',
      retailerName: 'Target',
      observedStock: 2,
    });
  });

  it('skips inventory_threshold rules without a false-to-true stock transition', () => {
    const evaluation = shouldTriggerAutoBuy(
      ruleFixture({
        userConsentAccepted: true,
        maxSpendAmount: 100,
        confirmationPolicy: 'auto_execute',
        cancellationWindowMinutes: 0,
        type: 'inventory_threshold',
        retailerName: 'Target',
        previousInStock: true,
        currentStock: 2,
        maxStock: 3,
      })
    );

    expect(evaluation.triggered).toBe(false);
  });

  it('fires time_window rules inside the configured UTC day/hour window under max price', async () => {
    mockFindMany.mockResolvedValue([
      ruleFixture({
        userConsentAccepted: true,
        maxSpendAmount: 100,
        confirmationPolicy: 'auto_execute',
        cancellationWindowMinutes: 0,
        type: 'time_window',
        startHour: 10,
        endHour: 12,
        daysOfWeek: ['monday'],
        maxPrice: 50,
      }),
    ]);

    await evaluateAutoBuyRules({ now: new Date('2026-05-04T11:00:00.000Z') });

    expect(mockCheckoutWithVirtualCard).toHaveBeenCalledWith('cart-1', 'user-1', 'card-1');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('skips time_window rules outside the configured UTC window', () => {
    const evaluation = shouldTriggerAutoBuy(
      ruleFixture({
        userConsentAccepted: true,
        maxSpendAmount: 100,
        confirmationPolicy: 'auto_execute',
        cancellationWindowMinutes: 0,
        type: 'time_window',
        startHour: 10,
        endHour: 12,
        daysOfWeek: ['monday'],
        maxPrice: 50,
      }),
      new Date('2026-05-04T13:00:00.000Z')
    );

    expect(evaluation.triggered).toBe(false);
  });

  it('reactivates executed recurring rules when their cadence interval has elapsed', async () => {
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: 'rule-recurring',
          status: 'executed',
          trigger: { type: 'recurring' },
          subscriptionCadence: { intervalDays: 7 },
          executedAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    await evaluateAutoBuyRules({ now: new Date('2026-04-08T00:00:00.000Z') });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'rule-recurring' },
      data: { status: 'active', executedAt: null },
    });
    expect(mockCheckoutWithVirtualCard).not.toHaveBeenCalled();
  });

  it('blocks triggered rules while the cancellation window is open', async () => {
    mockFindMany.mockResolvedValue([
      ruleFixture(safeTrigger({
        type: 'total_price_below',
        value: 40,
        approvedAt: '2026-05-06T10:00:00.000Z',
        cancellationWindowMinutes: 60,
      })),
    ]);

    await evaluateAutoBuyRules({ now: new Date('2026-05-06T10:30:00.000Z') });

    expect(mockCheckoutWithVirtualCard).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'autobuy.execution_blocked',
      metadata: expect.objectContaining({ reason: 'cancellation_window_open' }),
    }));
  });

  it('blocks triggered rules when the total exceeds the user spend limit', async () => {
    mockFindMany.mockResolvedValue([
      ruleFixture(safeTrigger({ type: 'total_price_below', value: 40, maxSpendAmount: 20 })),
    ]);

    await evaluateAutoBuyRules();

    expect(mockCheckoutWithVirtualCard).not.toHaveBeenCalled();
    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ reason: 'max_spend_exceeded' }),
    }));
  });
});
