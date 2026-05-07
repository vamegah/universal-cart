# Retailer Compliance and Business Model Boundaries

Universal Cart is currently an MVP shopping assistant. It must not be positioned as a way to bypass retailer checkout rules, card restrictions, or merchant terms.

## Enabled in the MVP

- User-consented product URL import from supported retailer pages.
- Product normalization and cross-store matching against known catalog/listing data.
- Price, shipping, tax, coupon-placeholder, and reward-value comparison.
- Redirect checkout routing when a merchant link or product-page flow is supported.
- Amazon multi-item add-to-cart routing when SKU/ASIN-style identifiers are available.
- Single-item verified product-page routing for supported non-Amazon merchants.

## Not Enabled in the MVP

- Automated purchase execution on external retailer sites.
- Multi-item non-Amazon cart prebuild without a formal merchant-supported mechanism.
- Charging a store card for another merchant's catalog unless a lawful marketplace, reseller, concierge, gift-card, or financing model is formally implemented.
- Virtual card checkout in production. Mock virtual cards are disabled unless `ENABLE_MOCK_PAYMENTS=true`.
- Gift card brokerage, card-linked offer activation, and financing arbitrage.
- Credential scraping or login-required cart manipulation.

## Retailer Operating Modes

| Retailer | Current Mode | Allowed MVP Behavior | Blocked Until Partnership/Review |
| --- | --- | --- | --- |
| Amazon | User-consented URL import and ASIN add-to-cart redirect | Import product metadata, match listings, generate supported cart-add URL when identifiers exist | Automated checkout, credentialed cart sync, order placement |
| Walmart | User-consented URL import and product-page/cart-link routing | Import product metadata, match listings, route a single verified listing | Multi-item cart prebuild, automated checkout |
| Target | User-consented URL import and product-page/cart-link routing | Import product metadata, match listings, route a single verified listing | Multi-item cart prebuild, automated checkout |
| Macy's | User-consented URL import and product-page/cart-link routing | Import product metadata, match listings, route a single verified listing | Claiming non-Macy's items can be charged through Macy's card unless sold through a valid Macy's/partner flow |
| Best Buy | User-consented URL import and product-page/cart-link routing | Import product metadata, match listings, route a single verified listing | Automated checkout, credentialed cart sync |
| Shopify stores | Generic supported URL import and product-page routing | Import metadata from supported public pages | Store-specific automated cart manipulation without store approval |

## Runtime Enforcement

Retailer operating modes are enforced by `apps/api/src/services/complianceService.ts`.

- Product URL import requires the `user_consented_url_import` action for the detected retailer.
- Checkout cart-add redirects require `cart_add_redirect`; currently only Amazon allows this action.
- Non-Amazon checkout routing uses `product_page_redirect` for verified listing URLs.
- `automated_checkout` is blocked for every retailer in the MVP policy set.

## Card and Payment Boundaries

- Store cards and cashback cards are represented as tokenized references only.
- Raw card numbers, CVV/CVC values, and PAN-like strings must not be accepted, logged, stored, or returned.
- Reward calculations are estimates unless they come from a validated provider or explicit merchant/card offer integration.
- Checkout routing should clearly explain when the user leaves Universal Cart to complete payment with the merchant.

## Required Review Before Launch

- Legal review of each retailer integration mode.
- Affiliate or partner agreement review for each outbound routing path.
- PCI scope assessment for card token storage and any future payment provider integration.
- Privacy review for account export/delete, audit retention, and cart metadata retention.
- Security review of rate limiting, logging, secrets, and abuse controls.
