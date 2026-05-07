/**
 * @jest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../../apps/api/src/index';
import { refreshAlerts } from '../../apps/api/src/services/alertRefreshService';
import { dispatchAlertNotification } from '../../apps/api/src/services/alertNotificationService';

jest.mock('../../apps/api/src/services/alertNotificationService', () => ({
  dispatchAlertNotification: jest.fn(),
}));

describe('alertRefreshService price-drop flow', () => {
  const alertDelegate = prisma.alertSubscription as any;
  const preferencesDelegate = prisma.userPreferences as any;
  const originalFindMany = alertDelegate.findMany;
  const originalUpdate = alertDelegate.update;
  const originalPreferencesFindMany = preferencesDelegate.findMany;
  const mockedDispatch = dispatchAlertNotification as jest.MockedFunction<typeof dispatchAlertNotification>;

  beforeEach(() => {
    mockedDispatch.mockReset();
    preferencesDelegate.findMany = async () => [];
  });

  afterEach(() => {
    alertDelegate.findMany = originalFindMany;
    alertDelegate.update = originalUpdate;
    preferencesDelegate.findMany = originalPreferencesFindMany;
  });

  it('updates the subscription and dispatches a notification when price falls below target', async () => {
    const updates: any[] = [];
    const subscription = {
      id: 'alert-1',
      alertType: 'price_drop',
      targetPrice: 100,
      user: { id: 'user-1', email: 'shopper@example.com' },
      product: {
        name: 'Noise Cancelling Headphones',
        retailerProducts: [{ retailerName: 'Amazon', price: 89.99, inStock: true }],
      },
    };

    alertDelegate.findMany = async (args: any) => {
      expect(args.where).toEqual({ status: 'active' });
      return [subscription];
    };
    alertDelegate.update = async (args: any) => {
      updates.push(args);
      return { ...subscription, ...args.data };
    };

    await refreshAlerts();

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      where: { id: 'alert-1' },
      data: { lastTriggeredAt: expect.any(Date) },
    });
    expect(mockedDispatch).toHaveBeenCalledWith({
      userId: 'user-1',
      userEmail: 'shopper@example.com',
      alertType: 'price_drop',
      productName: 'Noise Cancelling Headphones',
      alertId: 'alert-1',
      detail: 'Price is now $89.99 (target: $100.00)',
    });
  });

  it('does not dispatch when the lowest price is still above target', async () => {
    alertDelegate.findMany = async () => [
      {
        id: 'alert-2',
        alertType: 'price_drop',
        targetPrice: 100,
        user: { id: 'user-1', email: 'shopper@example.com' },
        product: {
          name: 'Noise Cancelling Headphones',
          retailerProducts: [{ retailerName: 'Amazon', price: 100.01, inStock: true }],
        },
      },
    ];
    alertDelegate.update = async () => {
      throw new Error('update should not be called');
    };

    await refreshAlerts();

    expect(mockedDispatch).not.toHaveBeenCalled();
  });
});
