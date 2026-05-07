import { describe, expect, it } from '@jest/globals';
import { summarizeDashboardState } from '../../apps/web/src/utils/dashboardSummary';

describe('dashboardSummary', () => {
  it('summarizes saved products, alerts, and latest checkout state', () => {
    const summary = summarizeDashboardState(
      [{ items: [{ id: 'a' }, { id: 'b' }] }, { items: [{ id: 'c' }] }],
      [{ status: 'active' }, { status: 'paused' }, { status: 'triggered' }, {}],
      [
        {
          action: 'checkout.validated',
          createdAt: '2026-05-01T10:00:00.000Z',
          summary: 'Checkout blocked for Target',
          metadata: { store: 'Target', ready: false, errors: [{}], warnings: [{}] },
        },
        { action: 'product.imported', createdAt: '2026-05-01T09:00:00.000Z' },
      ]
    );

    expect(summary.savedListCount).toBe(2);
    expect(summary.savedProductCount).toBe(3);
    expect(summary.activeAlertCount).toBe(2);
    expect(summary.triggeredAlertCount).toBe(1);
    expect(summary.openCheckoutState).toMatchObject({
      action: 'checkout.validated',
      store: 'Target',
      ready: false,
      issueCount: 2,
    });
  });
});
