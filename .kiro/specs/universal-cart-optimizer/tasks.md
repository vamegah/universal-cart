# Implementation Plan: Universal Cart & Checkout Optimizer

## Overview

Tasks are ordered by phase (Phase 1 → Phase 6). Each task builds on the previous ones and references specific files to create or modify. Phase 1 tasks are required; Phase 2–6 tasks are marked optional (`*`) where they extend beyond the MVP core. Property-based tests are included for the three core algorithmic services (pricing engine, split optimizer, matching engine) that have well-defined invariants.

---

## Tasks

- [x] 1. Harden retailer adapters and add keyword-search import

  - [x] 1.1 Audit and harden the BestBuy adapter (`apps/api/src/integrations/bestbuy/adapter.ts`)
    - Replace the random-SKU stub with real HTML scraping using `productParser.ts` helpers (JSON-LD, meta tags, DOM selectors)
    - Follow the same pattern as `AmazonAdapter` and `WalmartAdapter`
    - Throw a descriptive error when name, price, or SKU cannot be parsed
    - _Requirements: Import_Service — URL import must produce a normalized Product and RetailerProduct_

  - [x] 1.2 Audit and harden the Shopify adapter (`apps/api/src/integrations/shopify/adapter.ts`)
    - Replace the random-SKU stub with real Shopify JSON API (`/products/{handle}.json`) or JSON-LD extraction
    - Extract name, price, SKU, image, brand, and availability
    - Throw a descriptive error on parse failure
    - _Requirements: Import_Service — URL import must produce a normalized Product and RetailerProduct_

  - [x] 1.3 Add adapter integration tests for all six retailers
    - Create `apps/api/src/integrations/__tests__/adapters.test.ts`
    - For each adapter: mock `axios.get` with a fixture HTML file, assert that `fetchProduct` returns the expected shape (name, price, sku, image)
    - _Requirements: Import_Service_

  - [x]* 1.4 Write property tests for `productParser.ts`
    - **Property 1: `parsePrice` never returns a negative number for any non-empty string input**
    - **Property 2: `safeMatch` returns `null` or a non-empty string — never an empty string**
    - **Validates: Import_Service normalization invariants**

  - [x] 1.5 Implement `POST /api/import/search` — keyword-based product search
    - Add `searchController.ts` in `apps/api/src/controllers/` with a `searchProducts` handler
    - Accept `{ query: string, retailer?: string }` in the request body
    - For each adapter that supports search, call a new optional `searchProducts(query)` method on `BaseRetailerAdapter`; fall back to returning an empty array for adapters that do not implement it
    - Upsert matching Products and RetailerProducts; return a ranked list of results
    - Register the route in `apps/api/src/routes/import.ts` as `POST /search`
    - _Requirements: Import_Service — keyword search_

  - [x] 1.6 Add `searchProducts` to `BaseRetailerAdapter` and implement for Amazon and Walmart
    - Extend `baseAdapter.ts` with `searchProducts?(query: string): Promise<any[]>`
    - Implement for `AmazonAdapter` using the Amazon search URL pattern
    - Implement for `WalmartAdapter` using the Walmart search URL pattern
    - _Requirements: Import_Service — keyword search_

  - [x] 1.7 Expose match confidence score in the cart API response
    - Modify `apps/api/src/controllers/cartController.ts` (or the cart route) to include `confidenceScore` and `matchType` from the selected `MatchResult` when returning cart items
    - Ensure the `GET /api/cart` response includes `matchConfidence` and `matchType` per item
    - _Requirements: Matching_Engine — confidence score display_

  - [x] 1.8 Implement price re-fetch in `priceSyncWorker`
    - In `apps/api/src/workers/priceSyncWorker.ts`, after `refreshAlerts()`, iterate over all active `RetailerProduct` records and call the appropriate adapter's `fetchProduct(url)` to refresh `price`, `inStock`, and `lastUpdated`
    - Batch updates in groups of 20 to avoid rate-limiting; log errors per adapter without aborting the full run
    - _Requirements: Alert_Service — price sync must use live adapter data_

  - [x]* 1.9 Write property tests for `matchingService`
    - **Property 3: `confidenceScore` is always in [0, 1] for any candidate returned by `gatherCandidates`**
    - **Property 4: UPC match always produces a higher confidence than name-overlap match for the same product**
    - **Validates: Matching_Engine confidence invariants**

  - [x] 1.10 Checkpoint — ensure all Phase 1 tests pass
    - Run the full test suite; fix any failures before proceeding to Phase 2
    - Ensure all tests pass, ask the user if questions arise.
    - Evidence: `npm.cmd run test:smoke` passes OpenAPI validation, 129 unit tests, and the high-threshold production security audit. The audit blocker from `axios` was cleared by upgrading workspace pins to `^1.16.0`; Next/PostCSS remains moderate only in the production audit.

- [x]* 2. Complete Phase 2 — AI assistant, shared carts, and saved lists

  - [x]* 2.1 Add end-to-end test for the price-drop alert flow
    - Create `apps/api/src/__tests__/alerts.integration.test.ts`
    - Seed a product with a `RetailerProduct`, create an `AlertSubscription` with `targetPrice`, lower the product price in the DB, call `refreshAlerts()`, assert that `dispatchAlertNotification` was called with the correct payload
    - _Requirements: Alert_Service — price_drop alert end-to-end_

  - [x]* 2.2 Implement shared-cart invite/accept flow
    - Add `POST /api/lists/:id/invite` — sends an invite token (store in `SavedListShare.metadata`) and returns the token
    - Add `POST /api/lists/accept-invite` — accepts a token, creates or updates the `SavedListShare` record for the authenticated user
    - Implement both handlers in `apps/api/src/controllers/listController.ts`
    - Register routes in `apps/api/src/routes/lists.ts`
    - _Requirements: Saved_List — invite/accept collaboration flow_

  - [x]* 2.3 Add contributor write-guard to saved list mutations
    - In `listController.ts`, check `SavedListShare.role` before allowing `addSavedListItem`, `updateSavedListItem`, and `removeSavedListItem` for non-owner users
    - Return `403` when a viewer attempts a write operation
    - _Requirements: Saved_List — role-based access control_

  - [x]* 2.4 Write unit tests for saved list access control
    - Create `tests/unit/list-controller.test.ts`
    - Test that viewers cannot mutate items; contributors can; owners can do everything
    - _Requirements: Saved_List — role-based access control_

  - [x]* 2.5 Add `GET /api/lists/:id` single-list endpoint
    - Implement `getSavedList` handler in `listController.ts`
    - Return the list with items and shares; enforce owner-or-share access
    - Register in `apps/api/src/routes/lists.ts`
    - _Requirements: Saved_List — read access_

  - [x]* 2.6 Checkpoint — ensure Phase 2 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - Evidence: `tests/unit/alert-refresh-flow.test.ts` covers the price-drop refresh flow through mocked Prisma subscriptions and a mocked notification dispatcher. `npm.cmd run test:unit` passes 129 tests, and `npm.cmd run test:smoke` passes OpenAPI validation, unit tests, and the high-threshold production security audit.

- [x]* 3. Complete Phase 3 — browser extension hardening and gift card broker interface

  - [x]* 3.1 Harden extension content-script product detection for dynamic SPAs
    - In `apps/extension/product-detection.js`, add a `MutationObserver` that re-runs `getProductInfo` when the DOM title or price element changes (for React/Vue SPAs)
    - Debounce re-detection by 500 ms to avoid thrashing
    - _Requirements: Import_Service — extension-captured product data_

  - [x]* 3.2 Add extension background message for `importFromProductInfo`
    - In `apps/extension/background-core.js`, add `importFromProductInfo({ storage, fetchImpl, productInfo })` that calls `POST /api/import/url` with the detected URL, falling back to a search call if the URL is not a supported retailer
    - Wire it up in `apps/extension/background.js` as the `addToCart` action handler
    - _Requirements: Import_Service — extension import_

  - [x]* 3.3 Define `GiftCardBrokerAdapter` interface and stub
    - Create `apps/api/src/integrations/giftCardBroker/adapter.ts` with interface `GiftCardBrokerAdapter { purchaseGiftCard(retailerName: string, amount: number): Promise<{ code: string; pin?: string; balance: number }> }`
    - Create a `MockGiftCardBrokerAdapter` that returns a deterministic mock code when `ENABLE_MOCK_PAYMENTS=true`
    - _Requirements: Gift_Card_Broker — stub/interface_

  - [x]* 3.4 Create `giftCardService.ts` and `POST /api/giftcards/purchase` route
    - Implement `purchaseGiftCard(userId, retailerName, amount)` in `apps/api/src/services/giftCardService.ts`
    - Guard with `ENABLE_MOCK_PAYMENTS` flag; log a `VirtualCardTransaction`-style audit event
    - Add route in a new `apps/api/src/routes/giftcards.ts` and register in `apps/api/src/index.ts`
    - _Requirements: Gift_Card_Broker — purchase flow_

  - [x]* 3.5 Checkpoint — ensure Phase 3 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - Evidence: `apps/api/src/integrations/giftCardBroker/adapter.ts` defines the broker interface plus deterministic mock adapter, `apps/api/src/services/giftCardService.ts` guards purchases behind `ENABLE_MOCK_PAYMENTS=true` and records audit metadata, and authenticated `POST /api/giftcards/purchase` is mounted and documented. `npm.cmd run test:unit` passes 129 tests, `npm.cmd run build` passes, and `npm.cmd run test:smoke` passes OpenAPI validation, unit tests, and the high-threshold production security audit.

- [x]* 4. Complete Phase 4 — global split optimizer, threshold suggestions, and bundle discovery

  - [x]* 4.1 Upgrade `splitOptimizerService` to global optimization
    - In `apps/api/src/services/splitOptimizerService.ts`, add a `optimizeSplitPlanGlobal` function that considers cross-item shipping threshold interactions jointly (not per-item greedy)
    - Use a branch-and-bound or dynamic programming approach over the store assignment space when `items.length <= 20`; fall back to the existing greedy approach for larger carts
    - Expose the new function alongside the existing `optimizeSplitPlan` for backward compatibility
    - _Requirements: Split_Optimizer — global optimization_

  - [x]* 4.2 Write property tests for the split optimizer
    - **Property 5: Total cost of the global plan is always ≤ total cost of the greedy plan for the same inputs**
    - **Property 6: Every cart item appears exactly once in the assignments array**
    - **Property 7: `storeTotals` values sum to `totalCost` (within floating-point epsilon)**
    - **Validates: Split_Optimizer correctness invariants**

  - [x]* 4.3 Add `POST /api/optimize/global` route
    - Add `optimizeCartGlobal` handler in `apps/api/src/controllers/optimizeController.ts` that calls `optimizeSplitPlanGlobal`
    - Register in `apps/api/src/routes/optimize.ts`
    - _Requirements: Split_Optimizer — global optimization endpoint_

  - [x]* 4.4 Implement spending-threshold unlock suggestions
    - Add `getThresholdSuggestions(splitPlan, shippingThresholds)` in `splitOptimizerService.ts`
    - For each store where the current subtotal is within `gapTolerance` of a threshold, return a suggestion: `{ store, gap, shippingCostSaved, message }`
    - Expose via `GET /api/optimize/:cartId/suggestions` in `optimizeController.ts`
    - _Requirements: Split_Optimizer — threshold unlock suggestions_

  - [x]* 4.5 Implement cross-retailer bundle detection
    - Add `detectBundles(cartItems, retailerProducts)` in a new `apps/api/src/services/bundleService.ts`
    - A bundle is a set of ≥2 cart items that share a `category` and are all available at the same retailer at a combined price lower than the sum of individual best prices
    - Expose via `GET /api/optimize/:cartId/bundles`
    - _Requirements: Split_Optimizer — bundle discovery_

  - [x]* 4.6 Write unit tests for threshold suggestions and bundle detection
    - Create `apps/api/src/__tests__/optimizer.unit.test.ts`
    - Test threshold suggestion output for a cart near and far from a threshold
    - Test bundle detection with a fixture set of cart items
    - _Requirements: Split_Optimizer_

  - [x]* 4.7 Checkpoint — ensure Phase 4 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - Evidence: `optimizeSplitPlanGlobal` uses branch-and-bound for carts with up to 20 items and falls back to greedy for larger carts, `POST /api/optimize/global` exposes the global plan, `getThresholdSuggestions` powers `GET /api/optimize/:cartId/suggestions`, and `detectBundles` powers `GET /api/optimize/:cartId/bundles`. `tests/unit/optimizer-phase4.test.ts` covers global-vs-greedy cost, one assignment per item, store-total consistency, threshold suggestions, and bundle detection. `npm.cmd run test:unit` passes 129 tests, `npm.cmd run build` passes, and `npm.cmd run test:smoke` passes.

- [x]* 5. Complete Phase 5 — auto-buy agent triggers, price prediction, and subscription sync

  - [x]* 5.1 Add `inventory_threshold` trigger type to `autoBuyScheduler`
    - In `apps/api/src/services/autoBuyScheduler.ts`, add a branch for `trigger.type === 'inventory_threshold'`
    - Trigger fires when the selected `RetailerProduct.inStock` transitions from `false` to `true` and the item count at that retailer drops below `trigger.maxStock`
    - _Requirements: Auto_Buy_Agent — inventory_threshold trigger_

  - [x]* 5.2 Add `time_window` trigger type to `autoBuyScheduler`
    - Add a branch for `trigger.type === 'time_window'`
    - Trigger fires when the current UTC time falls within `trigger.startHour`–`trigger.endHour` on `trigger.daysOfWeek` and the cart total is below `trigger.maxPrice`
    - _Requirements: Auto_Buy_Agent — time_window trigger_

  - [x]* 5.3 Add `PATCH /api/autobuy/:id` and `DELETE /api/autobuy/:id` endpoints
    - Implement `updateAutoBuyRule` and `deleteAutoBuyRule` handlers in `apps/api/src/controllers/autobuyController.ts`
    - Register in `apps/api/src/routes/autobuy.ts`
    - _Requirements: Auto_Buy_Agent — rule management_

  - [x]* 5.4 Write unit tests for all three auto-buy trigger types
    - Create `apps/api/src/__tests__/autobuy.unit.test.ts`
    - Mock `prisma` and `checkoutWithVirtualCard`; assert each trigger type fires or skips correctly
    - _Requirements: Auto_Buy_Agent_

  - [x]* 5.5 Add `PriceHistory` model to Prisma schema
    - Add model `PriceHistory { id, retailerProductId, price, recordedAt }` to `apps/api/prisma/schema.prisma`
    - Create and run a migration: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_price_history/migration.sql`
    - _Requirements: Price prediction — historical price tracking_

  - [x]* 5.6 Record price history in `priceSyncWorker`
    - After each successful adapter price refresh (Task 1.8), insert a `PriceHistory` row for the updated `RetailerProduct`
    - _Requirements: Price prediction — historical price tracking_

  - [x]* 5.7 Implement simple price trend endpoint
    - Add `GET /api/pricing/:retailerProductId/history` that returns the last 90 days of `PriceHistory` records plus a simple linear trend (slope, min, max, average)
    - Implement in a new `pricePredictionService.ts` and wire to a new route in `apps/api/src/routes/pricing.ts`
    - _Requirements: Price prediction — trend data_

  - [x]* 5.8 Write property tests for the pricing engine
    - **Property 8: `effectiveTotal` ≤ `base + shipping + tax` for any non-negative rewards and loyalty values**
    - **Property 9: `effectiveTotal` is always ≥ 0 regardless of rewards/loyalty magnitude**
    - **Property 10: `estimateLineTotal` is monotonically non-decreasing in `quantity` when all per-unit costs are positive**
    - **Validates: Pricing_Engine correctness invariants**

  - [x]* 5.9 Implement subscription cart sync cadence
    - Add `subscriptionCadence` field (JSON) to `AutoBuyRule` via a new migration
    - In `autoBuyScheduler.ts`, add a `recurring` trigger type that re-activates an executed rule after `cadence.intervalDays` days
    - _Requirements: Subscription cart sync — recurring cadence_

  - [x]* 5.10 Checkpoint — ensure Phase 5 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - Evidence: `autoBuyScheduler` now supports `inventory_threshold`, `time_window`, and recurring cadence reactivation; `PATCH /api/autobuy/:id` and `DELETE /api/autobuy/:id` manage owned rules; `PriceHistory` and `AutoBuyRule.subscriptionCadence` were added via Prisma migration; `priceSyncWorker` records refreshed prices; and `GET /api/pricing/:retailerProductId/history` returns history with slope/min/max/average trends. `tests/unit/autobuy-scheduler.test.ts`, `tests/unit/autobuy-controller.test.ts`, `tests/unit/price-sync-worker.test.ts`, and `tests/unit/pricing-history-invariants.test.ts` cover the Phase 5 changes. `npm.cmd run test:unit` passes 143 tests, `npm.cmd run build` passes, `npm.cmd run validate:openapi` passes with 53 paths/63 operations, and `npm.cmd run test:smoke` passes.

- [x]* 6. Complete Phase 6 — virtual card issuance, card-linked offer injection, and financing arbitrage

  - [x]* 6.1 Integrate a real BaaS provider for virtual card issuance
    - In `apps/api/src/services/virtualCardService.ts`, replace the mock stub with a real Stripe Issuing (or Lithic/Marqeta) API call when `ENABLE_MOCK_PAYMENTS !== 'true'`
    - `issueVirtualCard(amount, merchantName)` must call the BaaS API, store the card token (not the PAN) in `VirtualCardTransaction`, and return only `{ last4, expiry }` to the caller
    - Add required env vars to `apps/api/.env.example`: `STRIPE_ISSUING_API_KEY`, `BAAS_PROVIDER`
    - _Requirements: Virtual_Card_Gateway — real BaaS integration_

  - [x]* 6.2 Implement `checkoutWithVirtualCard` end-to-end
    - Complete the stub in `virtualCardService.ts`: fetch cart items, group by retailer, issue one virtual card per retailer, call `adapter.addToCart` with the virtual card token, log each `VirtualCardTransaction`
    - _Requirements: Virtual_Card_Gateway — checkout flow_

  - [x]* 6.3 Add `POST /api/virtualcards/issue` and `POST /api/virtualcards/checkout` routes
    - Create `apps/api/src/controllers/virtualCardController.ts` with `issueCard` and `checkoutWithCard` handlers
    - Register in a new `apps/api/src/routes/virtualcards.ts` and mount in `apps/api/src/index.ts`
    - _Requirements: Virtual_Card_Gateway — API endpoints_

  - [x]* 6.4 Implement card-linked offer injection in the split optimizer
    - In `splitOptimizerService.ts`, before computing per-item costs, call `getCardLinkedOffers` and `calculateCardLinkedOfferValue` from `loyaltyService.ts` for each store option
    - Subtract the card-linked offer value from the effective total for that store
    - _Requirements: Virtual_Card_Gateway — card-linked offer rerouting_

  - [x]* 6.5 Write unit tests for card-linked offer injection
    - Create `apps/api/src/__tests__/cardLinkedOffers.unit.test.ts`
    - Assert that an item is rerouted to the store with the card-linked offer when the offer makes it cheaper
    - _Requirements: Virtual_Card_Gateway — card-linked offer rerouting_

  - [x]* 6.6 Implement zero-interest financing arbitrage service
    - Create `apps/api/src/services/financingArbitrageService.ts`
    - `getFinancingOptions(userId, totalAmount)` reads `UserCard.financingTerms` for each card, identifies cards with `apr === 0` and `minPurchase <= totalAmount`, and returns a ranked list of financing options
    - Expose via `GET /api/checkout/financing-options` in `checkoutController.ts`
    - _Requirements: Virtual_Card_Gateway — zero-interest financing arbitrage_

  - [x]* 6.7 Write unit tests for financing arbitrage
    - Create `apps/api/src/__tests__/financingArbitrage.unit.test.ts`
    - Test that only 0% APR cards above the minimum purchase threshold are returned, ranked by credit limit descending
    - _Requirements: Virtual_Card_Gateway — financing arbitrage_

  - [x]* 6.8 Checkpoint — ensure Phase 6 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - Evidence: `virtualCardService` now issues mock-gated or Stripe Issuing-backed virtual cards, stores provider card tokens in `VirtualCardTransaction` without returning raw card data, groups selected cart matches by retailer for virtual checkout, and exposes authenticated `POST /api/virtualcards/issue` plus `POST /api/virtualcards/checkout`. `splitOptimizerService` applies activated card-linked offers from user preferences before choosing store assignments. `financingArbitrageService` ranks eligible 0% APR `UserCard.financingTerms` via `GET /api/checkout/financing-options`. `tests/unit/virtual-card-service.test.ts`, `tests/unit/card-linked-offers.test.ts`, and `tests/unit/financing-arbitrage.test.ts` cover the Phase 6 changes. `npm.cmd run test:unit` passes 147 tests, `npm.cmd run build` passes, `npm.cmd run validate:openapi` passes with 56 paths/66 operations, and `npm.cmd run test:smoke` passes.

- [x]* 7. React web frontend — cart dashboard, match review, and optimize UI

  - [x]* 7.1 Build the `Cart.tsx` component (currently empty)
    - Implement `apps/web/src/components/Cart.tsx` as a full cart dashboard: list items with name, price, quantity controls, source retailer badge, match confidence badge, and remove button
    - Wire to `useCart` hook; show a loading skeleton while fetching
    - _Requirements: Cart — web dashboard_

  - [x]* 7.2 Add match confidence badge to `CartItem.tsx`
    - In `apps/web/src/components/CartItem.tsx`, display `matchType` and `confidenceScore` (as a percentage) returned from the API (Task 1.7)
    - Color-code: green for exact, yellow for close, orange for similar/substitute
    - _Requirements: Matching_Engine — confidence display_

  - [x]* 7.3 Build the split-optimizer UI panel
    - Add an `OptimizePanel.tsx` component in `apps/web/src/components/`
    - Call `POST /api/optimize` with the current cart items and user stores; display the resulting `SplitPlan` assignments grouped by store with per-store totals and threshold suggestions
    - _Requirements: Split_Optimizer — web UI_

  - [x]* 7.4 Add keyword search import to the `ImportForm.tsx` component
    - Extend `apps/web/src/components/ImportForm.tsx` to support a toggle between URL import and keyword search
    - On keyword search, call `POST /api/import/search` and display a result picker
    - _Requirements: Import_Service — keyword search UI_

  - [x]* 7.5 Build the alerts management page
    - Complete `apps/web/src/pages/alerts.tsx` with a form to create price-drop and restock alerts, a list of active subscriptions, and inline edit/delete controls
    - _Requirements: Alert_Service — web UI_

  - [x] 7.6 Write unit tests for web utility functions
    - Create `apps/web/src/__tests__/cartGrouping.test.ts`
    - Test `groupCartItems` with duplicate products from multiple retailers
    - _Requirements: Cart — grouping logic_
    - Evidence: `apps/web/src/components/Cart.tsx` now renders the cart dashboard with loading skeleton, metrics, grouped listings, source retailer badges, quantity/remove controls through `CartItem`, match review, transfer recommendations, and the new `OptimizePanel`. `CartItem.tsx` displays color-coded match confidence badges. `OptimizePanel.tsx` calls `POST /api/optimize`, groups split-plan assignments by store, and displays threshold suggestions. `ImportForm.tsx` supports URL and keyword-search modes backed by `POST /api/import/search` with a result picker. `alerts.tsx` supports create/list/pause/delete plus inline target-price editing. `tests/unit/web-cart-grouping.test.ts` covers duplicate cart grouping. `npm.cmd run test:unit` passes 147 tests, `npm.cmd run build` passes, and `npm.cmd run test:smoke` passes.

- [x] 8. Flutter mobile — cart view, alerts, and checkout

  - [x]* 8.1 Add match confidence display to `CartItemTile`
    - In `apps/mobile/lib/widgets/cart_item_tile.dart`, add a colored chip showing `matchType` and confidence percentage
    - _Requirements: Matching_Engine — mobile confidence display_

  - [x]* 8.2 Implement alerts screen in Flutter
    - Create `apps/mobile/lib/screens/alerts_screen.dart` with a list of active alert subscriptions and a FAB to create new ones
    - Add API calls for `GET /api/alerts`, `POST /api/alerts`, `DELETE /api/alerts/:id` to `apps/mobile/lib/services/api_service.dart`
    - _Requirements: Alert_Service — mobile UI_

  - [x]* 8.3 Add split-plan view to the checkout screen
    - In `apps/mobile/lib/screens/checkout_screen.dart`, after the user taps "Optimize", call `POST /api/optimize` and display the resulting store assignments before redirecting
    - _Requirements: Split_Optimizer — mobile UI_
    - Evidence: `CartItemTile` now displays color-coded match confidence chips, `alerts_screen.dart` lists alert subscriptions and creates/deletes alerts via new `ApiService` alert calls, the home screen exposes Alerts navigation, and `checkout_screen.dart` calls `POST /api/optimize` through `ApiService.optimizeCart` and displays split-plan assignments grouped by store before merchant redirect. `flutter analyze` passes, `npm.cmd run test:unit` passes 147 tests, `npm.cmd run build` passes, and `npm.cmd run test:smoke` passes. `flutter test` is not runnable yet because the mobile app has no `test/` directory.

- [x]* 9. OpenAPI spec and integration test suite

  - [x]* 9.1 Generate OpenAPI 3.1 spec from Express routes
    - Add `swagger-jsdoc` and `swagger-ui-express` to `apps/api/package.json`
    - Annotate all route handlers with JSDoc `@openapi` comments
    - Serve the spec at `GET /api/docs` and the UI at `GET /api/docs/ui`
    - _Requirements: API — OpenAPI completeness_
    - Evidence: `swagger-jsdoc` and `swagger-ui-express` are installed in `@universal-cart/api`; `scripts/generate-openapi.js` now consumes route/controller `@openapi` JSDoc blocks while preserving the existing route-manifest coverage flow; `docs/api/openapi.yaml` declares `openapi: 3.1.0`; and public `GET /api/docs` plus Swagger UI `GET /api/docs/ui` are mounted under `apps/api/src/routes/docs.ts`. `npm.cmd run validate:openapi` passes with 60 paths and 70 operations.

  - [x]* 9.2 Write end-to-end integration test for the full import → match → optimize → checkout flow
    - Create `apps/api/src/__tests__/e2e.integration.test.ts`
    - Use a test database (SQLite via `DATABASE_URL=file:./test.db`); seed one user and one product
    - Call `POST /api/import/url` (mock adapter), `POST /api/match`, `POST /api/optimize`, `POST /api/checkout/validate`, `POST /api/checkout/redirect` in sequence
    - Assert each step returns the expected shape and that the final redirect URL is well-formed
    - _Requirements: Full pipeline — end-to-end correctness_
    - Evidence: `tests/integration/e2e-pipeline.test.ts` seeds a dedicated user/product/listing, mocks Amazon adapter HTML through Axios, verifies `/api/docs` and `/api/docs/ui`, then runs authenticated import, cart fetch, match, selected-match persistence, split optimization, checkout validation, and checkout redirect assertions with dependency-order teardown.

  - [x]* 9.3 Write integration tests for the auto-buy worker pipeline
    - Create `apps/api/src/__tests__/autobuy.integration.test.ts`
    - Seed an active `AutoBuyRule` with `total_price_below` trigger; lower the cart total below the threshold; call `evaluateAutoBuyRules()`; assert the rule status becomes `executed` and a `VirtualCardTransaction` audit event is recorded
    - _Requirements: Auto_Buy_Agent — end-to-end_
    - Evidence: `tests/integration/autobuy-worker-pipeline.test.ts` enables mock payments, seeds a user/cart/cart item/selected retailer match and active `total_price_below` auto-buy rule, calls `evaluateAutoBuyRules()`, and asserts the rule executes with a charged mock `VirtualCardTransaction`.

  - [x]* 9.4 Final checkpoint - full test suite green
    - Run all unit, property, and integration tests; fix any failures
    - Ensure all tests pass, ask the user if questions arise.
    - Evidence: Docker/Postgres is available locally and full checkpoint verification passes. `npm.cmd run test:unit` passes 36 suites / 222 tests including property/invariant coverage. `npm.cmd run test:integration -- --runInBand --forceExit` passes 4 suites / 47 tests against `DATABASE_URL=postgresql://postgres:password@localhost:5432/universal_cart_verify`. `npm.cmd run validate:openapi` passes with 69 paths / 79 operations. `npm.cmd run test:e2e` passes 3 Playwright tests. `npm.cmd run build` and `npm.cmd run test:smoke` also pass; the web build still prints existing Next warnings for raw `<img>` usage and hook dependency arrays but exits successfully.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery
- Phase 1 tasks (1.x) are required and must be completed before Phase 2–6 work begins
- Each task references specific files to create or modify for traceability
- Property tests (Tasks 1.4, 1.9, 4.2, 5.8) validate universal invariants of the three core algorithmic services
- Unit and integration tests validate specific examples and edge cases
- Checkpoints at the end of each phase ensure incremental validation before proceeding
- The test framework (Jest or Vitest) should be added to `apps/api/package.json` devDependencies before executing any test tasks
