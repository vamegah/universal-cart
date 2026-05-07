# Payment Provider Contract

Universal Cart payment features are disabled in production unless a real provider is configured. Mock payment providers are development and test fixtures only.

## Runtime Rules

- `ENABLE_MOCK_PAYMENTS=true` may be used only outside `NODE_ENV=production`.
- Production virtual card issuance requires `BAAS_PROVIDER=stripe` plus Stripe Issuing credentials.
- API responses must never include PAN, CVV, CVC, or full provider secrets.
- Persisted payment records may store provider token references, provider card IDs, last4, expiry, amount, status, and reconciliation metadata.
- Logs and audit metadata must redact token, card, PAN, CVV/CVC, authorization, password, and secret fields.

## Virtual Card Provider Interface

A provider integration must return:

- `provider`: stable provider key, such as `stripe`.
- `providerCardId`: provider card identifier.
- `cardToken`: provider token/reference used internally for checkout orchestration.
- `last4`: display-only card suffix.
- `expiry`: display-only expiration in `MM/YY`.

Provider calls must enforce:

- Single-merchant metadata or controls where the provider supports it.
- Per-authorization spending limit equal to the approved checkout amount.
- No raw card number or security code storage.
- Transaction status updates for issued, charged, and failed states.

## Gift Card Broker Interface

A real broker integration must return gift card code, optional PIN, and balance only after a successful purchase. Until a real broker is configured, gift card purchase routes must return unavailable in production.

## Production Readiness Gates

- `GET /api/virtualcards/provider-status` must report the configured provider as ready and list no missing credentials.
- `npm run verify:stripe-issuing` must pass with `BAAS_PROVIDER=stripe`, a server-side `sk_test...` key, and a Stripe Issuing cardholder ID (`ich_...`).
- `npm run verify:stripe-issuing -- --create-card` must create a Stripe Issuing sandbox virtual card and the resulting timestamp must be recorded as `STRIPE_ISSUING_SANDBOX_VERIFIED_AT`.
- Compliance review completion must be recorded as `PAYMENT_COMPLIANCE_SIGNOFF_AT`.
- Refund, partial failure, dispute, and reconciliation handling documented.
- High-threshold security audit and smoke checks pass.

## Stripe Issuing Sandbox Checklist

1. Create or select a Stripe sandbox account with Issuing enabled.
2. Create a test Issuing cardholder in Stripe and copy the `ich_...` cardholder ID.
3. Set `BAAS_PROVIDER=stripe`, `STRIPE_ISSUING_API_KEY=sk_test_...`, and `STRIPE_ISSUING_CARDHOLDER_ID=ich_...` in the API environment. Do not use a publishable `pk_test...` key for server-side Issuing.
4. Run `npm run verify:stripe-issuing`.
5. Run `npm run verify:stripe-issuing -- --create-card` and record the printed `STRIPE_ISSUING_SANDBOX_VERIFIED_AT` value.
6. Complete compliance review and record `PAYMENT_COMPLIANCE_SIGNOFF_AT`.

If sandbox card creation fails with `requirements.past_due`, open the Stripe Dashboard cardholder record and complete the listed requirements before retrying. Common test-mode requirements include `individual.first_name`, `individual.last_name`, `individual.card_issuing.user_terms_acceptance.date`, and `individual.card_issuing.user_terms_acceptance.ip`. Those terms fields should only be supplied after the cardholder has accepted Stripe's required cardholder terms.
