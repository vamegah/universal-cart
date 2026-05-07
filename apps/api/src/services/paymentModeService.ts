export class PaymentModeError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'PaymentModeError';
    this.statusCode = statusCode;
  }
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function assertMockPaymentsAllowed(featureName = 'Mock payments') {
  if (process.env.ENABLE_MOCK_PAYMENTS !== 'true') {
    throw new PaymentModeError(`${featureName} is not configured`);
  }

  if (isProductionRuntime()) {
    throw new PaymentModeError(`${featureName} cannot be enabled in production`);
  }
}

export function getConfiguredBaasProvider() {
  return (process.env.BAAS_PROVIDER || 'stripe').toLowerCase();
}

function getStripeIssuingApiKey() {
  return process.env.STRIPE_ISSUING_API_KEY || process.env.STRIPE_SECRET_KEY || '';
}

function isStripeSecretTestKey(value: string) {
  return value.startsWith('sk_test_');
}

export function isPaymentProviderReadyForAutonomousCheckout() {
  if (process.env.ENABLE_MOCK_PAYMENTS === 'true') {
    return !isProductionRuntime();
  }

  const provider = getConfiguredBaasProvider();
  if (provider !== 'stripe') return false;

  const apiKey = getStripeIssuingApiKey();
  return Boolean(
    apiKey &&
    isStripeSecretTestKey(apiKey) &&
    process.env.STRIPE_ISSUING_CARDHOLDER_ID
  );
}

export function getVirtualCardProviderReadiness() {
  const provider = getConfiguredBaasProvider();
  const mockEnabled = process.env.ENABLE_MOCK_PAYMENTS === 'true';
  const production = isProductionRuntime();
  const missing: string[] = [];
  const warnings: string[] = [];

  if (mockEnabled) {
    if (production) {
      return {
        ready: false,
        provider: 'mock',
        mode: 'mock',
        missing: [],
        warnings: ['Mock virtual cards cannot be enabled in production.'],
        sandboxVerificationRequired: true,
        complianceSignoffRequired: true,
      };
    }

    return {
      ready: true,
      provider: 'mock',
      mode: 'mock',
      missing: [],
      warnings: ['Mock virtual cards are development-only and do not satisfy production readiness.'],
      sandboxVerificationRequired: true,
      complianceSignoffRequired: true,
    };
  }

  if (provider !== 'stripe') {
    return {
      ready: false,
      provider,
      mode: 'provider',
      missing: ['BAAS_PROVIDER=stripe'],
      warnings: [`Unsupported BaaS provider: ${provider}`],
      sandboxVerificationRequired: true,
      complianceSignoffRequired: true,
    };
  }

  const apiKey = getStripeIssuingApiKey();
  if (!apiKey) {
    missing.push('STRIPE_ISSUING_API_KEY or STRIPE_SECRET_KEY');
  } else if (!isStripeSecretTestKey(apiKey)) {
    missing.push('Stripe Issuing API key must be a secret test key that starts with sk_test_');
  }
  if (!process.env.STRIPE_ISSUING_CARDHOLDER_ID) {
    missing.push('STRIPE_ISSUING_CARDHOLDER_ID');
  }
  if (!process.env.STRIPE_ISSUING_SANDBOX_VERIFIED_AT) {
    warnings.push('Stripe Issuing sandbox card creation has not been recorded.');
  }
  if (!process.env.PAYMENT_COMPLIANCE_SIGNOFF_AT) {
    warnings.push('Payment compliance sign-off has not been recorded.');
  }

  return {
    ready: missing.length === 0,
    provider: 'stripe',
    mode: 'provider',
    missing,
    warnings,
    sandboxVerificationRequired: !process.env.STRIPE_ISSUING_SANDBOX_VERIFIED_AT,
    complianceSignoffRequired: !process.env.PAYMENT_COMPLIANCE_SIGNOFF_AT,
  };
}
