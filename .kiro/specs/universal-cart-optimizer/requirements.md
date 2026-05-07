# Requirements Document

## Introduction

The Universal Cart & Checkout Optimizer is a multi-phase platform that aggregates shopping items from any supported retailer into a single unified dashboard, matches each product to equivalent listings at the user's preferred merchants, and optimizes checkout routing based on total effective cost (price + shipping + tax minus rewards, loyalty, and coupons). The platform spans six phases: MVP cart aggregation and checkout routing (Phase 1), AI assistant and shared carts (Phase 2), browser extension and gift card brokering (Phase 3), split-cart optimization and bundle discovery (Phase 4), autonomous buying agents and predictive intelligence (Phase 5), and virtual card issuance with financial arbitrage (Phase 6).

The existing codebase provides a Node.js/TypeScript Express API backed by Prisma/PostgreSQL, a React web frontend, a Flutter mobile scaffold, a Chrome Manifest V3 browser extension, and partial implementations of cart, matching, pricing, split optimizer, auto-buy, virtual card, gift card broker, loyalty, coupon, shipping, seller trust, analytics, and audit services. Requirements in this document cover the full intended behavior of all phases, grounded in the existing schema and service contracts.

---

## Glossary

- **Platform**: The Universal Cart & Checkout Optimizer system as a whole.
- **User**: An authenticated human account holder interacting with the Platform.
- **Cart**: The active UniversalCart record associated with a User, containing one or more Cart Items.
- **Cart_Item**: A single product-quantity entry within a Cart, sourced from a specific retailer.
- **Product**: A normalized, retailer-agnostic product record identified by name, brand, model, UPC, and category.
- **Retailer_Product**: A retailer-specific listing linking a Product to a retailer with price, shipping cost, tax rate, stock status, and seller metadata.
- **Import_Service**: The subsystem responsible for accepting product URLs, search terms, or extension-captured data and producing normalized Product and Retailer_Product records.
- **Matching_Engine**: The subsystem that finds equivalent Retailer_Products at a destination retailer for a given source Product.
- **Pricing_Engine**: The subsystem that computes the effective total cost for a Retailer_Product, incorporating base price, shipping, tax, rewards, loyalty points, and coupon savings.
- **Split_Optimizer**: The subsystem that assigns each Cart_Item to the store that minimizes total effective cost across a multi-store order.
- **Checkout_Router**: The subsystem that validates checkout readiness and produces redirect URLs or virtual card checkout flows for supported retailers.
- **Auto_Buy_Agent**: The subsystem that monitors price and inventory triggers and executes purchases autonomously when conditions are met.
- **Virtual_Card_Gateway**: The subsystem that issues single-use, merchant-locked virtual payment cards via a BaaS provider.
- **Gift_Card_Broker**: The subsystem that purchases digital gift cards from third-party exchanges to fund retailer checkouts.
- **Loyalty_Engine**: The subsystem that calculates points earned, threshold rewards, statement credits, and card-linked offer values for a given retailer and spend amount.
- **Alert_Service**: The subsystem that monitors product prices and inventory and delivers notifications when user-defined conditions are met.
- **Audit_Service**: The subsystem that records immutable, timestamped events for every significant user and system action.
- **Seller_Trust_Service**: The subsystem that evaluates third-party seller risk signals and produces a trust score.
- **Retailer_Adapter**: A retailer-specific integration module that fetches product metadata and pricing from a supported retailer.
- **Saved_List**: A named, reusable collection of products that can be shared with other Users and restored into the active Cart.
- **Split_Plan**: A persisted assignment of Cart_Items to stores produced by the Split_Optimizer.
- **Match_Result**: A persisted record linking a Cart_Item to a Retailer_Product with a match type and confidence score.
- **confidence_score**: A float in [0, 1] representing the Matching_Engine certainty that a Match_Result is equivalent to the source product.
- **match_type**: One of exact, close, similar, or substitute, indicating the degree of product equivalence.
- **effective_total**: The final cost to the User after subtracting rewards, loyalty value, and confirmed coupon savings from the sum of base price, shipping, and tax.
- **BaaS**: Banking-as-a-Service provider used for virtual card issuance (e.g., Stripe Issuing, Lithic, Marqeta).
- **UPC**: Universal Product Code, a 12-digit barcode identifier.
- **GTIN**: Global Trade Item Number, a superset of UPC used for global product identification.
- **NLP**: Natural Language Processing, used for title-similarity matching.
- **PCI_DSS**: Payment Card Industry Data Security Standard.
- **GDPR**: General Data Protection Regulation.
- **CCPA**: California Consumer Privacy Act.
- **OAuth**: Open Authorization protocol used for third-party identity federation.
- **JWT**: JSON Web Token used for bearer authentication.
- **Admin**: A User whose email appears in the ADMIN_EMAILS environment variable, granting access to admin-only endpoints.

---

## Requirements
