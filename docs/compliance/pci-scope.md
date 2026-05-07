# PCI Scope Boundary

Universal Cart stores card preferences as tokenized provider references only. It is not a card-entry, authorization, settlement, or merchant-of-record system.

## In Scope for the MVP

- Provider token references such as `tok_*`, `pm_*`, `card_*`, `src_*`, `vc_*`, or approved mock/provider token formats.
- Card display metadata needed for user recognition: retailer name, last four digits, reward rate, and financing terms.
- Explicit user consent that the saved value is a tokenized reference.
- Application-level encryption of the stored token reference using AES-256-GCM.

## Out of Scope and Rejected

- Raw PAN/card numbers.
- CVV/CVC values.
- Magnetic stripe, chip, or bank account data.
- Direct card authorization, capture, settlement, or refund handling.
- Storing token references without explicit consent.

## Runtime Controls

- `paymentVaultService.ts` validates provider-token shape, rejects PAN-like values and CVV-shaped values, and encrypts token references before persistence.
- `profileController.ts` never returns `cardToken` in profile or card-create responses.
- Audit/log sanitization redacts token/card fields.
- Production requires `CARD_TOKEN_ENCRYPTION_KEY`; development falls back to a deterministic local-only key for zero-config tests.

## Provider Integration Boundary

Real provider token creation must happen in a PCI-capable provider flow before values are sent to Universal Cart. Universal Cart accepts only the resulting opaque token reference.
