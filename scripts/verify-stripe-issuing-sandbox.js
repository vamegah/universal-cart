#!/usr/bin/env node

const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });

const args = new Set(process.argv.slice(2));
const shouldCreateCard = args.has('--create-card');
const amount = Number(process.env.STRIPE_ISSUING_SANDBOX_AMOUNT_CENTS || 100);
const apiKey = process.env.STRIPE_ISSUING_API_KEY || process.env.STRIPE_SECRET_KEY || '';
const cardholder = process.env.STRIPE_ISSUING_CARDHOLDER_ID || '';

function redact(value) {
  if (!value) return '(missing)';
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function fail(message) {
  console.error(`Stripe Issuing sandbox verification failed: ${message}`);
  process.exitCode = 1;
}

function requireConfig() {
  const missing = [];
  if ((process.env.BAAS_PROVIDER || 'stripe').toLowerCase() !== 'stripe') {
    missing.push('BAAS_PROVIDER=stripe');
  }
  if (!apiKey) {
    missing.push('STRIPE_ISSUING_API_KEY or STRIPE_SECRET_KEY');
  } else if (!apiKey.startsWith('sk_test_')) {
    missing.push('Stripe Issuing API key must be a secret test key that starts with sk_test_');
  }
  if (!cardholder) {
    missing.push('STRIPE_ISSUING_CARDHOLDER_ID');
  } else if (!cardholder.startsWith('ich_')) {
    missing.push('STRIPE_ISSUING_CARDHOLDER_ID must be an Issuing cardholder id that starts with ich_');
  }
  if (missing.length > 0) {
    fail(`missing or invalid config: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

async function createSandboxCard() {
  const params = new URLSearchParams();
  params.set('currency', 'usd');
  params.set('type', 'virtual');
  params.set('cardholder', cardholder);
  params.set('status', 'active');
  params.set('spending_controls[spending_limits][0][amount]', String(amount));
  params.set('spending_controls[spending_limits][0][interval]', 'per_authorization');
  params.set('metadata[universalCartVerification]', 'UC-051');
  params.set('metadata[merchantName]', 'Universal Cart Sandbox');
  params.set('metadata[merchantLocked]', 'true');

  const response = await axios.post('https://api.stripe.com/v1/issuing/cards', params, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    timeout: Number(process.env.STRIPE_ISSUING_SANDBOX_TIMEOUT_MS || 15000),
  });

  return response.data;
}

async function fetchCardholderRequirements() {
  const response = await axios.get(`https://api.stripe.com/v1/issuing/cardholders/${cardholder}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: Number(process.env.STRIPE_ISSUING_SANDBOX_TIMEOUT_MS || 15000),
  });

  const requirements = response.data?.requirements || {};
  return {
    status: response.data?.status,
    disabledReason: requirements.disabled_reason || null,
    pastDue: requirements.past_due || [],
  };
}

async function main() {
  console.log('Stripe Issuing sandbox preflight');
  console.log(`- Provider: ${(process.env.BAAS_PROVIDER || 'stripe').toLowerCase()}`);
  console.log(`- API key: ${redact(apiKey)}`);
  console.log(`- Cardholder: ${redact(cardholder)}`);

  if (!requireConfig()) return;

  if (shouldCreateCard) {
    const requirements = await fetchCardholderRequirements();
    if (requirements.disabledReason || requirements.pastDue.length > 0) {
      fail(
        [
          `cardholder requirements are incomplete: ${requirements.disabledReason || 'requirements.past_due'}`,
          `past_due=${requirements.pastDue.join(', ') || 'unknown'}`,
        ].join('; ')
      );
      return;
    }
    console.log('- Cardholder requirements: passed');
  }

  if (!shouldCreateCard) {
    console.log('- Config check: passed');
    console.log('Run `npm run verify:stripe-issuing -- --create-card` to create a sandbox virtual card.');
    return;
  }

  const card = await createSandboxCard();
  const verifiedAt = new Date().toISOString();
  console.log('- Sandbox card creation: passed');
  console.log(`- Provider card id: ${card.id}`);
  console.log(`- Display card: **** ${card.last4 || 'unknown'} exp ${String(card.exp_month || '').padStart(2, '0')}/${String(card.exp_year || '').slice(-2)}`);
  console.log('');
  console.log('Record this verification timestamp in the API environment:');
  console.log(`STRIPE_ISSUING_SANDBOX_VERIFIED_AT="${verifiedAt}"`);
}

main().catch((error) => {
  const responseMessage = error.response?.data?.error?.message;
  fail(responseMessage || error.message || 'unknown Stripe error');
});
