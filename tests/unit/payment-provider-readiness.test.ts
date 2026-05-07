/**
 * @jest-environment node
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import { getVirtualCardProviderReadiness } from '../../apps/api/src/services/paymentModeService';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('virtual card provider readiness', () => {
  it('reports missing Stripe Issuing credentials and readiness gates', () => {
    delete process.env.ENABLE_MOCK_PAYMENTS;
    process.env.BAAS_PROVIDER = 'stripe';
    delete process.env.STRIPE_ISSUING_API_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_ISSUING_CARDHOLDER_ID;

    const status = getVirtualCardProviderReadiness();

    expect(status).toMatchObject({
      ready: false,
      provider: 'stripe',
      mode: 'provider',
      sandboxVerificationRequired: true,
      complianceSignoffRequired: true,
    });
    expect(status.missing).toEqual([
      'STRIPE_ISSUING_API_KEY or STRIPE_SECRET_KEY',
      'STRIPE_ISSUING_CARDHOLDER_ID',
    ]);
  });

  it('reports configured Stripe credentials while still surfacing sandbox and compliance gates', () => {
    delete process.env.ENABLE_MOCK_PAYMENTS;
    process.env.BAAS_PROVIDER = 'stripe';
    process.env.STRIPE_ISSUING_API_KEY = 'sk_test_ready';
    process.env.STRIPE_ISSUING_CARDHOLDER_ID = 'ich_ready';

    const status = getVirtualCardProviderReadiness();

    expect(status).toMatchObject({
      ready: true,
      provider: 'stripe',
      missing: [],
      sandboxVerificationRequired: true,
      complianceSignoffRequired: true,
    });
    expect(status.warnings).toContain('Stripe Issuing sandbox card creation has not been recorded.');
  });

  it('rejects publishable Stripe keys for server-side Issuing calls', () => {
    delete process.env.ENABLE_MOCK_PAYMENTS;
    process.env.BAAS_PROVIDER = 'stripe';
    process.env.STRIPE_ISSUING_API_KEY = 'pk_test_not_server_side';
    process.env.STRIPE_ISSUING_CARDHOLDER_ID = 'ich_ready';

    const status = getVirtualCardProviderReadiness();

    expect(status).toMatchObject({
      ready: false,
      provider: 'stripe',
      missing: ['Stripe Issuing API key must be a secret test key that starts with sk_test_'],
    });
  });

  it('rejects mock readiness in production', () => {
    process.env.ENABLE_MOCK_PAYMENTS = 'true';
    Object.assign(process.env, { NODE_ENV: 'production' });

    expect(getVirtualCardProviderReadiness()).toMatchObject({
      ready: false,
      provider: 'mock',
      warnings: ['Mock virtual cards cannot be enabled in production.'],
    });
  });
});
