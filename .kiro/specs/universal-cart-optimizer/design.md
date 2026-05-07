# Design Document: Universal Cart and Checkout Optimizer

## Overview

The Universal Cart & Checkout Optimizer is a six-phase platform that aggregates shopping items from any supported retailer into a single unified dashboard, matches each product to equivalent listings at the user preferred merchants, and optimizes checkout routing based on total effective cost. The backend is a Node.js/TypeScript Express API (apps/api/src/index.ts) backed by Prisma ORM and PostgreSQL, with a React web frontend, Flutter mobile scaffold, and Chrome Manifest V3 browser extension.

This document describes the technical design for all six phases, grounded in the existing service, route, and schema implementations.

---

## 1. Architecture Overview

`
Client Layer
  React Web App | Flutter Mobile | Chrome Extension (MV3)
       |               |                  |
       +---------------+------------------+
                       | HTTPS / REST
                       v
Express API  (apps/api/src/index.ts)
  Middleware: requireAuth, requireAdmin, rateLimit, requestContext
  Routes: /api/auth /api/profile /api/cart /api/import /api/match
          /api/pricing /api/optimize /api/checkout /api/autobuy
          /api/alerts /api/lists /api/shipping /api/rules /api/budget
          /api/analytics /api/audit /api/privacy /api/admin
       |
  +----+--------------------+--------------------+
  v                         v                    v
Service Layer          Integration Layer    Background Workers
  cartService            RetailerAdapter      autoBuyWorker (*/30)
  matchingService        (Amazon/Walmart/     priceSyncWorker (*/30)
  pricingService          Target/Macys/
  splitOptimizerService   BestBuy/Shopify)
  virtualCardService      registry.ts
  autoBuyScheduler        productParser.ts
  loyaltyService
  couponService
  shippingOptimizerService
  sellerTrustService
  alertRefreshService
  auditService
  analyticsService
  budgetService
  cartRulesService
  privacyService
       |
       v
Data Layer
  PostgreSQL (Prisma ORM)          Redis (rate limiting, optional)
  Models: User, UserPreferences, UserCard, Product
          RetailerProduct, UniversalCart, CartItem
          MatchResult, SplitPlan, AutoBuyRule
          SavedList, SavedListItem, SavedListShare
          AlertSubscription, UserShippingPlan
          VirtualCardTransaction, AuditEvent
`

### Service Boundaries

| Boundary | Responsibility |
|---|---|
| Import Service | URL to normalized Product + RetailerProduct + CartItem |
| Matching Engine | CartItem to ranked MatchResult candidates per destination store |
| Pricing Engine | RetailerProduct + user context to effective total |
| Split Optimizer | Cart items x stores to minimum-cost SplitPlan |
| Checkout Router | SplitPlan to redirect URLs or virtual card flows |
| Auto-Buy Agent | AutoBuyRule triggers to autonomous checkout execution |
| Alert Service | AlertSubscription conditions to notifications |
| Audit Service | All significant actions to immutable AuditEvent log |

### Data Flow: Import to Match to Optimize to Checkout

`
User submits URL
  POST /api/import/url
  RetailerAdapter.fetchProduct(url)
  upsert Product + RetailerProduct
  addItemToCart -> CartItem created
  POST /api/match  (per destination store)
  matchingService.findMatchForProduct
  MatchResult candidates saved
  POST /api/optimize
  splitOptimizerService.optimizeSplitPlan
  SplitPlan persisted
  POST /api/checkout/validate
  POST /api/checkout/redirect  ->  redirectUrl returned to client
`

---