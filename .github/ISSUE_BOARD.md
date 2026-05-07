# Universal Cart Production Readiness Issue Board

Audit date: 2026-04-28

## Verdict

All tracked readiness issues in this board are now implemented and marked `Done`.

The repository has moved from scaffold to a verified MVP foundation: API and web builds pass, authentication and persisted sessions exist, cart persistence is server-backed, Prisma is aligned to PostgreSQL with clean migrations, retailer routing is registry-based, payment mocks are feature-gated, Stripe Issuing sandbox verification and compliance sign-off are recorded, and unit/integration/e2e/smoke validation pass locally. Final production launch still requires environment-specific deployment checks, live vendor/account approvals, live broker/provider credentials where used, and acceptance of any upstream dependency advisories that do not yet have fixes.

## Verification Evidence

- `npm.cmd run build` passes across API, web, matching-engine, retailer-client, shared-types, and ui-kit workspaces.
- The web build runs on Next 15.5.15. It still prints existing Next lint warnings for raw `<img>` usage and hook dependency arrays, but exits successfully.
- `npm.cmd run test:unit` passes 222 unit tests covering password hashing/verification, persisted session creation/rotation/revocation, coupon placeholder behavior, split optimizer behavior, shopping copilot command parsing/pending recommendations, shipping optimizer behavior, loyalty value calculation, seller trust scoring, analytics summarization, admin retailer summaries/config overlays, admin match queue summaries, admin seller trust summaries, cart rule parsing and rule rejection explanations, smart match assistant explanations/approval prompts, image-aware match recall with human-review flags, dashboard saved-list/alert/checkout summaries, return preference optimization, price forecasting/restock estimates, rate limiting, cart grouping, persisted cart hydration/upsert behavior, retailer request retry/timeout handling, extension message flow, extension session refresh/logout, extension product detection across supported retailers, extension preferred-merchant price comparison, retailer adapters/search, cart match fields, product normalization, backend duplicate grouping, matching outcomes and variant safety, checkout variant readiness, checkout route-mode/fallback metadata, retailer compliance policy enforcement, PCI-conscious card vault validation/encryption/consent, payment mock production guards, virtual-card provider readiness gates, settlement ledger balancing/refunds/failure recording, gift card broker configuration/balance tracking/purchase limits, price sync and price history recording, price-drop alert refresh flow, extension dynamic product detection and fallback import flow, gift card mock broker guards, virtual-card issuance/checkout guards, global split optimization, threshold suggestions, bundle detection, card-linked offer rerouting, financing option ranking, financing APR/installment cost modeling, auto-buy trigger/rule management/safety gates, pricing invariants, product parser invariants, matching confidence invariants, and saved-list collaboration access control including item attribution/approval.
- `npm.cmd run test:e2e` passes 3 Playwright smoke tests covering the authenticated MVP shopping journey plus accessibility landmarks, labeled controls, skip-link keyboard access, and narrow mobile viewport overflow checks.
- `npm.cmd run validate:openapi` passes required-path and bearer-auth validation for 69 documented paths / 79 operations in `docs/api/openapi.yaml`.
- `npm.cmd run test:smoke` passes OpenAPI validation, unit tests, and high-threshold security audit without requiring local PostgreSQL.
- Root `npm test` still exits successfully but does not execute meaningful workspace tests beyond packages that define their own test scripts.
- `npm.cmd run security:audit` passes at the high threshold.
- `npm.cmd audit --json` reports 1 moderate production dependency advisory from Next's nested PostCSS plus high-severity Playwright-related entries in the dev dependency graph; `npm.cmd run security:audit` still passes because production audit omits dev/optional dependencies. The prior Axios high advisory was cleared by upgrading workspace pins to `^1.16.0`.
- The repository is not currently a Git repository in this workspace, so branch/commit status could not be verified.
- Prisma is configured for PostgreSQL, has baseline and follow-up migration files, uses native JSON columns for JSON-shaped data, includes production lookup indexes, and the generated client now includes `UserShippingPlan`, `PriceHistory`, `AutoBuyRule.subscriptionCadence`, provider-token metadata on `VirtualCardTransaction`, `SettlementLedgerEntry`, and `PurchasedGiftCard`. Docker Postgres verification now passes: all 18 migrations apply cleanly to a fresh `universal_cart_verify` database, `prisma migrate status` reports the schema up to date, and the Phase 9 import/match/optimize/checkout plus auto-buy worker integration specs pass locally against `localhost:5432`.
- Cart, import, checkout, matching, match persistence, profile, pricing, and auto-buy routes now require signed bearer-token authentication.
- Product import uses a supported retailer registry for Amazon, Walmart, Target, Macy's, Best Buy, and Shopify/generic supported URLs.
- Matching, pricing, checkout routing, split optimization, auto-buy, gift card, settlement, and virtual card services now have MVP implementations with safety gates. Gift card purchases require a configured broker for production use, and virtual cards use Stripe Issuing with sandbox verification and compliance sign-off recorded locally.
- Audit events are now persisted for import, matching, pricing, checkout, and profile/card changes, with a user-facing web Audit Trail page.
- Privacy export and account deletion controls are implemented behind authentication.
- Saved lists/reusable carts now have authenticated backend APIs, PostgreSQL schema/migration coverage, OpenAPI documentation, privacy export/delete handling, and a web Saved Lists page for create, save active cart, rename, restore, and delete.
- Alert subscriptions now have authenticated backend APIs, PostgreSQL schema/migration coverage, OpenAPI documentation, privacy export/delete handling, audit events, and a web Alerts page for cart-product price/restock/transfer/promo/card-offer subscriptions.
- The web dashboard/cart flow now has imported-cart metrics, saved product counts, alert counts, transferred-product state, latest checkout readiness/routing state, grouped listings, loading state, source and match-confidence badges, match review, transfer recommendations, split optimization, keyword search import, and inline alert target editing.
- Seller trust fields and scoring are now part of retailer listings and match recommendations, with cart UI display for trust score/signals and admin review/correction for risky seller listings.
- MVP analytics now derives user and admin/global KPI summaries from persisted audit/cart/card/split-plan data, including checkout completion, DAU observations, financing utilization, and split-cart adoption, and exposes web Analytics/Admin dashboard views.
- Shipping consolidation now has an MVP optimizer and web comparison page for cost-first, fewest-packages, and fastest-delivery plans.
- Loyalty memberships can now be stored in profile preferences and are monetized in pricing comparisons alongside card rewards.
- Saved lists now support MVP collaboration by sharing with existing users by email and role, invite-token creation/acceptance, contributor write access, viewer read-only access, and single-list reads.
- Admin users can now inspect and configure retailer adapter/catalog health through an admin-gated API and web page, including pricing refresh cadence, catalog ingestion status, affiliate mode, and partnership state.
- Admin users can now review low-confidence/substitute match candidates, manually select a match, reject bad candidates, and blacklist risky listings from future matching.
- Cart rules can now be parsed from natural language into versioned, structured, editable rules, automatically applied by the split optimizer, and surfaced with rejection explanations.
- API request logging now emits request IDs and uses a redacting structured logger; no backend `console.*` calls remain in `apps/api/src`.
- The browser extension and mobile service layer now default API calls to `http://localhost:3001/api` with configurable overrides. Extension popup users can now sign in/sign up against the backend, persist the bearer token automatically, sign out, sync the displayed cart count from the authenticated backend cart, and compare the current product page against their preferred store. Extension product detection and background import/cache logic are factored into testable modules with fixture coverage for JSON-LD, OpenGraph, Amazon, Walmart, Target, dynamic SPA re-detection, authenticated imports, unsupported-URL search fallback, duplicate cache updates, backend cart-count sync, and login token storage. Mobile now has login/signup/session refresh/logout UI, authenticated cart hydration and cart mutations, import UI, preferred-store profile sync, match-confidence chips, alerts management, checkout split-plan display, visible API endpoint configuration, and `flutter analyze` passes locally.
- README now reflects implemented vs planned capabilities. OpenAPI has been refreshed for the current MVP API surface, retailer/business-model constraints are documented, and CI/deploy validation requirements including Playwright, k6, and deployed health checks are documented in `docs/ci.md`.

## Labels

- Priority: `P0`, `P1`, `P2`, `P3`
- Phase: `phase-1-mvp`, `phase-2-post-mvp`, `phase-3-growth`, `phase-4-orchestration`, `phase-5-autonomous`, `phase-6-financial`
- Area: `backend`, `frontend`, `mobile`, `extension`, `data`, `infra`, `security`, `compliance`, `testing`, `docs`, `ai-ml`, `retailer-integration`, `payments`, `analytics`, `admin`

---

## P0 Production Blockers

### UC-001 Fix monorepo build failures
- Status: Done
- Labels: `P0`, `testing`, `infra`
- Evidence: `npm.cmd run build` now passes across all workspaces.
- Tasks:
  - Add missing package dependencies and type packages.
  - Fix empty module exports.
  - Fix retailer-client path/export mismatches.
  - Make all workspace `build` scripts pass on a clean install.
- Acceptance criteria:
  - `npm.cmd run build` passes from the repository root.
  - `npm.cmd run build --workspaces` passes in CI.

### UC-002 Restore deterministic dependency installation
- Status: Done
- Labels: `P0`, `infra`, `testing`
- Evidence: The repo now uses npm consistently: `package-lock.json` is present, root scripts use `npm`, and `packageManager` is `npm@11.3.0`. `npm.cmd run security:audit` passes at the high threshold; 2 moderate Next/PostCSS findings remain without an available upstream fix.
- Tasks:
  - Decide on `npm` or `pnpm` as the canonical package manager.
  - Regenerate lockfile with all workspace dependencies.
  - Update docs and CI to use the same package manager.
- Acceptance criteria:
  - Fresh install followed by build and tests works without manual package installs.

### UC-003 Implement a real CI pipeline
- Status: Done
- Labels: `P0`, `testing`, `infra`
- Evidence: `.github/workflows/ci.yml` installs dependencies, provisions PostgreSQL, runs Prisma migration deploy/generate, lints, builds, runs unit tests, integration tests, Playwright e2e smoke tests, OpenAPI validation, production high-threshold security audit, k6 load smoke tests, smoke checks, and uploads test/build artifacts. API and web deploy workflows now start with the same required validation job and deployment jobs use `needs: validate`, so deploy steps are blocked unless lint/build/tests/OpenAPI/audit/load/smoke checks pass. `deploy-web.yml` now uses npm, requires `NEXT_PUBLIC_API_URL`, and builds a static `apps/web/out` export for S3. Deploy jobs run post-rollout deployed health checks when the required health URLs are configured. `docs/ci.md` documents service containers, required CI env vars, e2e mocking strategy, load smoke strategy, deployed health checks, and deploy secrets. Local verification: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:e2e`, `npm.cmd run test:smoke`, and `npm.cmd run test:unit` pass.
- Tasks:
  - Install dependencies.
  - Run lint, typecheck/build, unit tests, integration tests, and e2e smoke tests.
  - Upload test artifacts.
  - Block deploy workflows unless CI passes.
- Acceptance criteria:
  - Pull requests fail when build or tests fail.
  - CI documents required environment variables and service containers.

### UC-004 Export API app without auto-start side effects
- Status: Done
- Labels: `P0`, `backend`, `testing`
- Evidence: integration tests import `{ app }`, but `apps/api/src/index.ts` does not export `app` and starts the HTTP server plus worker immediately.
- Tasks:
  - Split Express app construction from server startup.
  - Export `app` for tests.
  - Start workers only in the runtime entrypoint.
- Acceptance criteria:
  - Supertest can import the app without opening a port or starting cron jobs.

### UC-005 Implement authentication and user identity
- Status: Done
- Labels: `P0`, `backend`, `frontend`, `security`, `phase-1-mvp`
- Evidence: Cart, import, checkout, matching, pricing, profile, cards, saved lists, alerts, privacy, budget, admin, and auto-buy routes require signed bearer-token authentication. API supports signup, login, `/auth/me`, token expiry, and `scrypt` password hashing. `UserSession` persists hashed session tokens with session IDs, token IDs, user-agent/IP metadata, expiration, and revocation timestamps. Signup/login/dev-token create persisted sessions; `POST /api/auth/refresh` rotates the current session token hash; `POST /api/auth/logout` revokes the current session so reused tokens are rejected. Web Account and extension flows refresh and logout against these endpoints while storing only the current bearer token client-side. OpenAPI documents session-backed auth responses, and unit coverage verifies token hashes are stored instead of raw tokens, refresh rotation, and logout revocation.
- Tasks:
  - Implement signup, login, logout, refresh/session handling.
  - Hash passwords or integrate OAuth/passwordless auth.
  - Protect cart, profile, cards, checkout, and auto-buy routes.
  - Add frontend auth state and guarded pages.
- Acceptance criteria:
  - No user-specific API route accepts unauthenticated requests.
  - Users can only access their own carts, preferences, cards, and orders.

### UC-006 Align Prisma with production PostgreSQL
- Status: Done
- Labels: `P0`, `backend`, `data`, `infra`, `phase-1-mvp`
- Evidence update: `schema.prisma`, local `apps/api/.env`, and CI use PostgreSQL. Formal migrations exist for the baseline schema, JSONB cleanup, shipping plans, production lookup indexes, provider-token metadata, settlement ledger, purchased gift cards, and persisted sessions. The duplicate `SplitPlan` follow-up migration was made idempotent so clean PostgreSQL migration deploys no longer fail when the baseline already created the table. Docker Postgres verification now succeeds: `docker compose up -d postgres redis`, fresh `universal_cart_verify` database creation, `npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma` with `DATABASE_URL=postgresql://postgres:password@localhost:5432/universal_cart_verify`, `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma`, and `npx.cmd prisma generate --schema apps/api/prisma/schema.prisma` all pass. The full DB-backed integration suite now passes against Docker Postgres: `npm.cmd run test:integration -- --runInBand --forceExit` with 4 suites / 47 tests passing.
- Tasks:
  - Switch provider to PostgreSQL.
  - Add migrations.
  - Replace JSON-as-string fields with `Json` where appropriate.
  - Add indexes and unique constraints for UPC, retailer SKU, cart lookups, and match lookups.
- Acceptance criteria:
  - API runs against Docker Postgres.
  - Migrations apply cleanly in local, CI, and deployment environments.

### UC-007 Fix broken cart persistence flow
- Status: Done
- Labels: `P0`, `backend`, `frontend`, `data`, `phase-1-mvp`
- Evidence: Product import now creates/updates the backend source listing and adds or increments the product in the authenticated backend cart. Web cart hydrates from `/api/cart` when authenticated, maps the API's canonical source listing price/SKU/URL into local UI state, and upserts repeated server-backed imports/search additions instead of duplicating optimistic local items. Backend cart normalization returns selected match fields, duplicate group keys, source listing details, source retailer, quantity, normalized product data, and selected retailer product IDs. Web remove/update/clear call authenticated API mutations, and focused unit tests cover selected match/source listing normalization, duplicate grouping, and local upsert behavior for persisted cart items.
- Tasks:
  - Define canonical cart ownership in backend.
  - Wire import, add, remove, update quantity, match selection, and checkout to persisted cart data.
  - Sync frontend state from API.
- Acceptance criteria:
  - Cart survives reload, login from another device, and API restart.
  - Cart items include source retailer, quantity, normalized product, source listing, and selected match.

### UC-008 Replace mock checkout redirect with supported merchant routing
- Status: Done
- Labels: `P0`, `backend`, `checkout`, `retailer-integration`, `phase-1-mvp`
- Evidence: Checkout no longer returns generic fake merchant URLs. It returns a real Amazon `/gp/cart/add.html` cart-add URL for SKU-backed items and supports honest single-item product-page routing for verified Walmart/Target/Macy's/BestBuy/Shopify listing URLs where compliance allows product-page redirects. Checkout readiness revalidates store support, price, availability, quantity, variant, substitute approval, and budget controls before creating a redirect. `POST /api/checkout/stores` now reports route type, route message, and limitations for each store so the web Checkout page shows whether a store uses cart prebuild, product-page redirect, single-item route, or transparent unsupported fallback. Multi-item non-Amazon cart prebuild remains intentionally unsupported until formal merchant integrations exist, and the UI/API now say so explicitly instead of pretending a mock checkout exists. Focused unit coverage verifies Amazon multi-item cart prebuild metadata, non-Amazon multi-item fallback messaging, and verified single-item product-page redirects.
- Tasks:
  - Choose one MVP merchant with a legally supported redirect or affiliate flow.
  - Generate real destination links or cart URLs using supported parameters/APIs.
  - Revalidate price, availability, quantity, and variant before redirect.
- Acceptance criteria:
  - A real item can be routed to a supported destination checkout/affiliate page.
  - UI shows when cart prebuild is unsupported and falls back transparently.

### UC-009 Remove fake card and virtual checkout behavior from production paths
- Status: Done
- Labels: `P0`, `payments`, `security`, `compliance`, `phase-6-financial`
- Evidence: Mock virtual card and mock gift card paths are centralized behind `assertMockPaymentsAllowed`, require `ENABLE_MOCK_PAYMENTS=true`, and explicitly fail when `NODE_ENV=production` even if the mock flag is accidentally enabled. Virtual card API responses return only display-safe `last4` and `expiry`; raw PAN/CVV values are never generated or returned, and provider tokens remain internal/persisted as provider references for orchestration. `BAAS_PROVIDER=stripe` remains the production provider path, returning 503 until Stripe Issuing credentials are configured. `docs/compliance/payment-provider-contract.md` defines the Stripe/provider and gift-card broker integration contract, production gates, and no-raw-card-data rules. Unit coverage verifies production mock denial for virtual cards and gift cards, token-only virtual-card behavior, disabled mock broker behavior, and audit metadata that omits full gift card codes.
- Tasks:
  - Gate virtual cards behind explicit disabled feature flags.
  - Remove fake card data from any production-accessible route.
  - Define integration contract for Stripe Issuing/Lithic/Marqeta before implementation.
- Acceptance criteria:
  - Production cannot emit fake PAN/CVV values.
  - Payment features are disabled unless a real provider is configured.

---

## Phase 1 MVP: Core Shopping Platform

### UC-010 Implement retailer domain validation and adapter registry
- Status: Done
- Labels: `P1`, `backend`, `retailer-integration`, `phase-1-mvp`
- Evidence: `apps/api/src/integrations/registry.ts` identifies supported domains and rejects unsupported retailers. Adapters exist for Amazon, Walmart, Target, Best Buy, Macy's, and Shopify/generic supported stores.
- Tasks:
  - Create supported retailer registry with domain matching.
  - Return clear unsupported retailer errors.
  - Add Amazon, Walmart, Target, Best Buy, Macy's, Shopify/generic adapters.
- Acceptance criteria:
  - Import identifies retailer correctly or rejects unsupported domains.

### UC-011 Implement real product URL import parsing
- Status: Done
- Labels: `P1`, `backend`, `retailer-integration`, `phase-1-mvp`
- Evidence: Product adapters parse structured product-page metadata and registry-selected URLs. BestBuy uses JSON-LD/meta/DOM extraction instead of generated SKU stubs, Shopify prefers `/products/{handle}.json` with HTML metadata fallback, and comma-formatted prices parse correctly. `safeMatch` returns `null` for empty captures, and property-style unit coverage checks that parsed prices are never negative and parser captures are null-or-non-empty. Keyword search exists at authenticated `POST /api/import/search`; Amazon and Walmart implement adapter-level `searchProducts(query)`, and search results are upserted into Product/RetailerProduct without modifying the active cart. Imports/search/price sync now run adapter calls through shared retailer retry/timeout handling, returning actionable 502/504 import errors with retailer context and retryability while keeping parser failures non-retried. Price sync refreshes persisted RetailerProduct price/stock timestamps through retailer adapters in batches after alert refresh, logging per-listing failures without aborting the run. Focused tests cover all six URL adapters, Amazon/Walmart search adapters, cart match fields, parser invariants, price sync behavior, and retry/timeout semantics. Live official APIs/feeds remain a production partnership concern, but the user-consented MVP import path now meets the local acceptance criteria.
- Tasks:
  - Parse title, price, image, SKU, availability, brand, model, UPC/GTIN where available.
  - Respect approved APIs, affiliate feeds, or user-consented extraction paths.
  - Add retry, timeout, and error handling.
- Acceptance criteria:
  - Known product URLs produce retailer-specific metadata.
  - Import failure surfaces actionable errors to the user.

### UC-012 Implement product normalization
- Status: Done
- Labels: `P1`, `backend`, `data`, `phase-1-mvp`
- Evidence: Import now normalizes product data before lookup/upsert through `productNormalizationService`: titles, brand/model text, UPC/GTIN digit formats, category aliases, color/size attributes, canonical variant names, and variant keys are compacted into stable normalized fields while preserving raw source metadata separately. Import lookup now uses normalized UPC, then brand/model, then normalized name so equivalent listings can map to one canonical product. `tests/unit/product-normalization.test.ts` covers GTIN cleanup, variant canonicalization, category normalization, and raw metadata preservation.
- Tasks:
  - Normalize title, brand, model, UPC/GTIN, color, size, category, and attributes.
  - Store raw source metadata separately from normalized product data.
  - Add canonicalization for common variants.
- Acceptance criteria:
  - Equivalent listings can map to one canonical product.
  - Source metadata remains auditable.

### UC-013 Implement duplicate detection and product grouping
- Status: Done
- Labels: `P1`, `backend`, `frontend`, `data`, `phase-1-mvp`
- Evidence: Cart and dashboard group items by backend-provided duplicate keys, UPC, product ID, brand/model, or normalized title while preserving each source listing and quantity. Import reuses canonical products by normalized UPC, brand/model, and normalized name, and source listings by retailer SKU. `GET /api/cart` now returns normalized `items` with `duplicateGroupKey` plus `groups` containing item IDs, total quantity, source retailers, source listings, variant key, and selected-match counts. Backend grouping separates different color/size variants when UPC is unavailable. `tests/unit/cart-controller.test.ts` covers cross-retailer duplicate grouping, source listing preservation, and variant separation; `tests/unit/web-cart-grouping.test.ts` covers frontend grouping behavior.
- Tasks:
  - Detect duplicates by UPC, retailer SKU, brand/model, and normalized title.
  - Group exact duplicates in cart UI.
  - Preserve multiple source listings and quantities.
- Acceptance criteria:
  - Importing the same item from multiple stores shows one normalized product group.

### UC-014 Persist source listings safely
- Status: Done
- Labels: `P1`, `backend`, `data`, `phase-1-mvp`
- Evidence: `RetailerProduct` now has a composite unique key on `(retailerName, retailerSku)`, and import upserts source listings by that identity while refreshing price, URL, inventory, and timestamp.
- Tasks:
  - Add composite unique key such as `(retailerName, retailerSku)` or normalized source URL hash.
  - Upsert by real unique listing identity.
  - Track last fetched price and availability.
- Acceptance criteria:
  - Re-importing the same source URL updates the existing listing instead of duplicating it.

### UC-015 Implement cross-store matching engine v1
- Status: Done
- Labels: `P1`, `backend`, `ai-ml`, `phase-1-mvp`
- Evidence: Matching returns ranked candidates with confidence and explanation signals across exact, close, substitute, and unavailable outcomes. UPC/GTIN values are normalized before lookup; seller trust is included in candidate confidence and response signals; out-of-stock exact matches are returned as `unavailable`; and color/size/variant-key conflicts downgrade candidates to substitute instead of silently approving them. `gatherCandidates` is exported for direct invariant coverage. `tests/unit/property-invariants.test.ts` asserts candidate confidence stays within `[0, 1]` and UPC matches outrank name-overlap matches. `tests/unit/matching-service.test.ts` covers exact UPC matching with seller trust, close name/brand matching, substitute category matching, unavailable exact listings, variant mismatch downgrades, and no-match behavior.
- Tasks:
  - Match by UPC/GTIN, brand/model, normalized attributes, and title similarity.
  - Return exact, close, substitute, unavailable.
  - Rank candidates by confidence.
  - Include explanation signals.
- Acceptance criteria:
  - API returns ranked candidates with confidence and reasons.
  - Tests cover exact, close, substitute, and no-match cases.

### UC-016 Persist match results and selected match state
- Status: Done
- Labels: `P1`, `backend`, `frontend`, `data`, `phase-1-mvp`
- Evidence: Authenticated `/api/match/candidates` and `/api/match/select` persist candidate results and selected match state for a user's cart item.
- Tasks:
  - Save match candidates per cart item.
  - Add endpoint to select/unselect match.
  - Show selected match in cart and checkout.
- Acceptance criteria:
  - User selections persist across reloads and sessions.

### UC-017 Implement price and reward comparison v1
- Status: Done
- Labels: `P1`, `backend`, `frontend`, `phase-1-mvp`
- Evidence: Authenticated `/api/pricing/compare` compares source vs destination listing totals with base price, shipping, tax, coupon placeholder, and stored card reward value. After matching, the cart UI now displays source vs destination total, reward value, effective total, and the recommendation explanation.
- Tasks:
  - Compute base price, shipping estimate, tax estimate, coupons placeholder, and reward value.
  - Include user card rewards from profile.
  - Show original total vs destination total vs effective rewards-adjusted total.
- Acceptance criteria:
  - UI answers whether preferred merchant checkout is actually cheaper.

### UC-018 Implement merchant/card preference profile
- Status: Done
- Labels: `P1`, `backend`, `frontend`, `security`, `phase-1-mvp`
- Evidence: Authenticated `/api/profile` persists preferred store, default card reference, shipping preference, return preferences, loyalty memberships, budget controls, card-linked offers, and tokenized card reward references. The web Profile page provides CRUD for card references, loyalty memberships, card-linked offers, budget controls, shipping method, and return preferences, while preserving existing preference modules such as cart rules and offers when saving. Profile card storage accepts only provider-token-shaped references, rejects raw PAN/CVV-like values, requires explicit vault consent, encrypts card tokens, and never returns `cardToken`. Return preferences now influence split optimization by excluding options that violate minimum return-window/final-sale preferences. Unit coverage verifies return-preference optimization behavior.
- Tasks:
  - Persist preferred stores, store cards, cashback cards, shipping preferences, return preferences, loyalty memberships.
  - Tokenize payment/card references through a provider; never store raw PAN.
  - Add CRUD UI and API.
- Acceptance criteria:
  - Preferences personalize matching and pricing after login on another device.

### UC-019 Implement universal shopping dashboard
- Status: Done
- Labels: `P1`, `frontend`, `backend`, `phase-1-mvp`
- Evidence update: Home dashboard now shows product group count, source retailer count, matched item count, estimated savings, preferred match store, default checkout store, saved product/list counts, active/triggered alert counts, transferred-product count, latest checkout readiness/routing state from audit events, and recent cart groups with links into lists, alerts, cart, checkout, audit, analytics, and profile. `dashboardSummary.ts` centralizes saved-list/alert/checkout summary calculation with unit coverage. `Cart.tsx` provides the main cart dashboard with loading skeleton, product-group metrics, source-retailer badges, grouped listings, checkout actions, `MatchSelector`, `TransferRecommendation`, and split optimizer panel. `ImportForm.tsx` supports URL import and keyword search with a result picker.
- Tasks:
  - Show imported carts, saved products, transferred products, preferred merchants, rewards profile, alerts, and open checkout routing state.
  - Add empty/loading/error states.
  - Add accessibility and responsive layout checks.
- Acceptance criteria:
  - Dashboard is usable for the main MVP shopping flow without local-only state.

### UC-020 Implement checkout readiness checks
- Status: Done
- Labels: `P1`, `backend`, `frontend`, `checkout`, `phase-1-mvp`
- Evidence: Authenticated checkout validation checks supported merchant routing, item quantity, inventory, price-change warnings, selected variant compatibility, unverified matched variants, and blocks similar/substitute matched items until the user explicitly approves them in the web checkout UI. `/api/checkout/redirect` now re-runs the same readiness evaluator and returns 422 with errors/warnings instead of silently routing stale, unavailable, mismatched-variant, over-budget, or unapproved substitute items. Live merchant price freshness remains bounded by the latest persisted retailer listing until real-time merchant APIs are available.
- Tasks:
  - Validate selected items, quantities, variants, price freshness, inventory, and selected destination.
  - Detect price or availability changes before redirect.
  - Ask user approval for substitutes.
- Acceptance criteria:
  - Checkout cannot silently route stale or substituted items.

---

## Browser Extension and Mobile

### UC-021 Fix extension API base URL and environment configuration
- Status: Done
- Labels: `P1`, `extension`, `phase-1-mvp`
- Evidence: Extension background imports now default through `extension-config.js`, support storage-backed `apiBaseUrl`/`webBaseUrl` overrides, and forward a stored bearer token. `addToCart` imports from detected product info: it first calls authenticated `/import/url`, then falls back to `/import/search` plus `/cart/items` for unsupported retailer URLs when a page title is available. The popup includes sign-in/sign-up/sign-out controls that exchange credentials with `/auth/login` and `/auth/signup`, persist tokens automatically, retain optional manual token override for development, refresh stale sessions through `/auth/refresh`, and call `/auth/logout` before local cleanup. `npm.cmd run package:extension` emits `dist/extension` with environment-specific endpoints from `UNIVERSAL_CART_EXTENSION_API_URL` and `UNIVERSAL_CART_EXTENSION_WEB_URL`, enforcing HTTPS when `NODE_ENV=production`.
- Tasks:
  - Add configurable API endpoint.
  - Support dev and production endpoints.
  - Handle auth token/session.
- Acceptance criteria:
  - Extension can import into the authenticated user's backend cart.

### UC-022 Implement extension product detection hardening
- Status: Done
- Labels: `P2`, `extension`, `retailer-integration`, `phase-3-growth`
- Evidence: Content script now extracts product data through reusable `product-detection.js` from JSON-LD Product structured data and OpenGraph/Twitter/product meta tags before falling back to retailer selectors. Retailer fallbacks now cover Amazon, Walmart, Target, Macy's, Best Buy, and Shopify/generic product pages, including SKU/listing ID extraction where available. `observeProductChanges` uses a debounced `MutationObserver` to re-detect title/price changes on dynamic SPA product pages and keep the content script's latest product info fresh. Jest fixture coverage validates JSON-LD, OpenGraph, Amazon, Walmart, Target, Macy's, Best Buy, Shopify/generic, and dynamic re-detection extraction paths. Popup settings expose API URL, web URL, account login, and auth token configuration. The displayed cart count syncs from the authenticated backend cart when a token is present, with local fallback for unsigned sessions. Duplicate imports update the cached item instead of appending another entry and the on-page control reports when the cart was updated.
- Tasks:
  - Improve selectors per supported retailer.
  - Use structured data (`application/ld+json`, OpenGraph, meta tags) before brittle DOM selectors.
  - Add duplicate detection and cart item count.
- Acceptance criteria:
  - Extension imports supported product pages with useful success/failure feedback.

### UC-023 Add preferred merchant comparison in extension
- Status: Done
- Labels: `P2`, `extension`, `matching`, `phase-3-growth`
- Evidence: The extension can request product metadata from the active product page, use the signed-in user's backend `defaultStore`, call authenticated `/match`, and show preferred-store match type, confidence, destination price, matched-product link, and checkout-path availability in both the popup and an on-page comparison status. It now also compares the detected current-page price against the preferred-store matched listing price without requiring the user to import/add the product first, surfaces whether the preferred store is cheaper before tax/shipping/rewards, and displays an explicit "available at preferred store with a checkout path" status when the matched listing can route to checkout.
- Tasks:
  - Show "available at preferred merchant" status.
  - Show live price comparison and confidence.
  - Alert when a preferred checkout path exists.
- Acceptance criteria:
  - Popup/content UI shows current page match options without visiting the web app.

### UC-024 Fix mobile API configuration and auth
- Status: Done
- Labels: `P2`, `mobile`, `phase-2-post-mvp`
- Evidence update: Mobile now refreshes stored sessions through `/auth/refresh` during app restore and calls `/auth/logout` before local sign-out cleanup. The signed-in account screen displays the active API endpoint so environment-specific `--dart-define=UNIVERSAL_CART_API_URL=...` configuration is visible to testers. `flutter analyze` passes.
- Evidence: Mobile API service defaults to `http://localhost:3001/api`, supports `--dart-define=UNIVERSAL_CART_API_URL=...`, and attaches a stored bearer token to protected import, match, match selection, alerts, optimize, and checkout calls. The mobile app includes login/signup/session restore UI, authenticated backend cart hydration, remote quantity/remove/clear mutations, a working product import form, preferred-store profile sync, cart/checkout defaults from that profile, match-confidence chips, alert management, and checkout split-plan display. Broader profile CRUD and payment/card preference editing remain web-only but are outside this issue's API/auth/cart-sync acceptance criteria.
- Tasks:
  - Add environment-specific backend URL.
  - Implement login/session token storage.
  - Sync cart and profile with backend.
- Acceptance criteria:
  - Mobile app can import, match, and route using the same backend account as web.

### UC-025 Implement mobile share-to-app import
- Status: Done
- Labels: `P2`, `mobile`, `phase-2-post-mvp`
- Evidence: `ShareHandlerService` wraps `receive_sharing_intent` and emits shared URLs as a stream. `ShareImportScreen` handles import progress, success, error, and unauthenticated states. `main.dart` wires the stream to push `ShareImportScreen` when a URL arrives cold or while the app is running. Android `AndroidManifest.xml` registers an `ACTION_SEND`/`text/plain` intent filter. iOS `Info.plist` declares the share extension activation rule for web URLs and text.
- Tasks:
  - Register share targets for iOS and Android.
  - Accept product URLs from browser/share sheet.
  - Add import progress and error states.
- Acceptance criteria:
  - User can share a retailer URL into the app and see it in the universal cart.

---

## Optimization, Routing, and Commerce Logic

### UC-026 Implement cart transfer recommendation view
- Status: Done
- Labels: `P1`, `frontend`, `backend`, `phase-1-mvp`
- Evidence: `TransferRecommendation.tsx` component classifies each matched cart item as exact match, substitute, or unavailable at the preferred store. Shows a summary bar (exact/substitute/unavailable counts), per-item rows with source→destination, confidence %, savings label (Save $X / $X more / Same price), and a link to view the matched product. Bulk controls: "Transfer all" / "Keep all at source" per classification group. Item-by-item Transfer / Keep at source toggle buttons with active state styling. Unavailable items shown as staying at source with no decision required. Once all decidable items have a decision, a summary panel shows transfer count and a Proceed to checkout link. Cart page wired to show `TransferRecommendation` after `MatchSelector` completes, using `preferredMatchStore` from preferences.

### UC-027 Implement split-cart optimizer v1
- Status: Done
- Labels: `P2`, `backend`, `optimization`, `phase-2-post-mvp`
- Evidence update: Mobile Checkout now calls `POST /api/optimize` via `ApiService.optimizeCart` and displays split-plan assignments grouped by store with per-store totals before checkout redirect.
- Evidence update: Web `OptimizePanel.tsx` calls authenticated `POST /api/optimize`, displays assignments grouped by store with per-store totals, surfaces card-linked offer adjustments when present, and shows threshold suggestions near free-shipping thresholds.
- Evidence update: Added `optimizeSplitPlanGlobal` for branch-and-bound global assignment across carts with up to 20 items and greedy fallback for larger carts. Added `getThresholdSuggestions`, `bundleService.ts`, `POST /optimize/global`, `GET /optimize/:cartId/suggestions`, and `GET /optimize/:cartId/bundles`. New tests cover global-vs-greedy cost, one assignment per item, store-total consistency, threshold suggestions, and bundle detection.
- Evidence: `splitOptimizerService.ts` extended with `ShippingThreshold` type and `applyShippingThresholds` — consolidates items to a store when its subtotal is within `gapTolerance` of the free-shipping threshold and the item price delta is less than the shipping cost saved; returns `thresholdSavings` map per store. `optimizeSplitPlan` accepts optional `shippingThresholds` parameter. `optimizeController.ts` persists the plan as a `SplitPlan` record when `cartId` is supplied and belongs to the authenticated user; returns `splitPlanId` in response. `GET /optimize/:cartId/latest` retrieves the most recent persisted plan for a cart. Migration `20260430100000_split_plan` adds `SplitPlan` table with `cartId` FK and index. Unit tests cover threshold consolidation within tolerance and no-consolidation when gap exceeds tolerance.

### UC-028 Implement shipping consolidation optimization
- Status: Done
- Labels: `P2`, `backend`, `frontend`, `phase-4-orchestration`
- Evidence: `shippingRateService.ts` provides a pluggable carrier rate estimator with realistic subtotal-based defaults (free ≥$50, $4.99 ≥$25, $6.99 <$25) plus weight surcharges, speed surcharges (expedited +$8, overnight +$18), and Amazon 2-day defaults. Provider factory swaps in real carrier SDK (UPS/FedEx/USPS) when `CARRIER_RATE_PROVIDER` env var is set. `POST /shipping/rates` exposes batch rate estimation. `UserShippingPlan` Prisma model + migration `20260430110000_user_shipping_plan` persists user-selected plans with `userId`, `cartId`, `planName`, `planData`, `totalCost`. `POST /shipping/select` persists chosen plan with audit event. `GET /shipping/selected` retrieves most recent plan. Web API service adds `estimateShippingRates`, `selectShippingPlan`, `getSelectedShippingPlan`. Shipping page updated: runs rate estimation alongside plan comparison, displays carrier rate estimates per retailer, plan cards are clickable to select, Save plan button persists selection with confirmation.

### UC-029 Implement loyalty and reward optimization
- Status: Done
- Labels: `P2`, `backend`, `frontend`, `phase-2-post-mvp`
- Evidence: `loyaltyService.ts` extended with `CategoryBonus` type (per-category points multiplier), `statementCreditRate` field on `LoyaltyMembership`, `CardLinkedOffer` type (percent/fixed discount, minSpend, maxDiscount, expiresAt, activated flag). `calculateLoyaltyValue` applies category bonus multiplier when `category` is passed and adds `statementCreditValue` to effective total. `calculateCardLinkedOfferValue` evaluates activated offers against subtotal with min-spend and cap enforcement. `getExpiringPromos` and `getExpiringCardOffers` return items expiring within 48h. `alertRefreshService` calls `checkExpiryReminders` after each subscription sweep, dispatching `promo_expiration` and `card_offer` notifications for all users with expiring items. `PUT /profile/card-offers` persists card-linked offers array in preferences with validation and audit event. Web API service adds `upsertCardLinkedOffers`. Profile page loads card offers from preferences, renders add/activate/deactivate/remove UI with expiry date and discount type, and saves via dedicated button.

### UC-030 Implement coupon and promo engine placeholder safely
- Status: Done
- Labels: `P2`, `backend`, `phase-2-post-mvp`
- Evidence: Added coupon provider abstraction with a placeholder evaluator. Pricing returns estimated coupon eligibility separately from applied savings, never subtracts unconfirmed savings from effective totals, and the cart UI labels coupon estimates as not applied until confirmed.
- Tasks:
  - Model coupon eligibility and stacking rules.
  - Add provider abstraction.
  - Avoid claiming savings until validated.
- Acceptance criteria:
  - Pricing breakdown distinguishes estimated from confirmed discount values.

### UC-031 Implement audit trail for cart and recommendation actions
- Status: Done
- Labels: `P1`, `backend`, `data`, `security`, `phase-1-mvp`
- Evidence: `AuditEvent` is persisted in PostgreSQL with user/entity/action indexes. API records events for product import, match generation/no-match, match candidate save, match selection, pricing comparison, checkout validation/redirect creation, and profile/card changes. Authenticated `/api/audit` returns the current user's events and the web app has an Audit Trail page.
- Tasks:
  - Record import source, normalization, match signals, price snapshots, user approvals, and checkout routing changes.
  - Add user-facing audit view.
- Acceptance criteria:
  - User can see where an item came from, why it matched, and what changed before checkout.

---

## Alerts, Saved Lists, Collaboration, and Budgets

### UC-032 Implement price drop and restock alerts
- Status: Done
- Labels: `P2`, `backend`, `frontend`, `phase-2-post-mvp`
- Evidence update: Mobile `AlertsScreen` now loads alert subscriptions, creates alerts from current cart products, deletes subscriptions, and is reachable from the signed-in home screen.
- Evidence update: Web `alerts.tsx` now supports create/list/pause/activate/delete plus inline target-price editing for existing alert subscriptions.
- Evidence: Authenticated `/api/alerts` endpoints support listing, creating/upserting, pausing/activating, and deleting subscriptions. `alertRefreshService.ts` evaluates all active subscriptions against current `RetailerProduct` data for price_drop, restock, transfer_opportunity, promo_expiration, and card_offer conditions. `alertNotificationService.ts` records in-app audit events and sends email via SMTP when `SMTP_HOST`/`SMTP_FROM` are configured (nodemailer lazy-required). `priceSyncWorker.ts` runs the refresh on a cron schedule (default every 30 min, overridable via `ALERT_REFRESH_CRON`). Worker is started alongside the auto-buy worker in `index.ts`. `tests/unit/alert-refresh-flow.test.ts` now verifies that a below-target price-drop subscription updates `lastTriggeredAt` and dispatches the expected notification payload, while above-target prices do not dispatch.
- Tasks:
  - Add alert subscriptions.
  - Schedule price/inventory refresh.
  - Send email/push/in-app notifications.
- Acceptance criteria:
  - Users receive alerts for price drops, restocks, transfer opportunities, promo expirations, and card offer reminders.

### UC-033 Implement saved carts and reusable lists
- Status: Done
- Labels: `P2`, `backend`, `frontend`, `phase-2-post-mvp`
- Evidence: Authenticated saved-list APIs support listing, creating, saving the active cart as a list, renaming, restoring list items into the active cart, and deleting. Item-level editing is now complete: `POST /:id/items` adds or increments an item, `PATCH /:id/items/:itemId` updates quantity with validation, `DELETE /:id/items/:itemId` removes an item — all with audit events and `updatedAt` refresh. Web API service exposes `addSavedListItem`, `updateSavedListItem`, `removeSavedListItem`. The Saved Lists page renders inline quantity editing and per-item remove controls for all list items, with overflow count for lists longer than 4 items.
- Tasks:
  - Add named lists: family, office supplies, holiday, recurring household.
  - Support converting saved list to active cart.
- Acceptance criteria:
  - Users can create, edit, reuse, and delete saved lists.

### UC-034 Implement shared cart collaboration
- Status: Done
- Labels: `P2`, `backend`, `frontend`, `phase-2-post-mvp`
- Evidence: Saved lists now support MVP collaboration: owners can share a list with an existing user by email as viewer or contributor, create an invite token stored in `SavedListShare.metadata`, and accept invite tokens through `POST /api/lists/accept-invite`. Collaborators can see shared lists, read one list through `GET /api/lists/{id}`, and restore accessible lists into their cart. Contributors can add/update/remove saved-list items; viewers receive `403` on item mutations; owners can remove shares. Saved-list items now track `addedByUser`, `updatedByUser`, and optional `approvedByUser`/`approvedAt` through a PostgreSQL migration, controller writes, API responses, OpenAPI documentation, and web Saved Lists attribution/approval controls. Privacy export/delete includes owned and shared-list records, and focused unit tests cover role access, invite acceptance, and item approval. Collaboration never exposes private payment/profile card data.
- Tasks:
  - Invite users to a cart or list.
  - Add roles and permissions.
  - Track who added or approved items.
- Acceptance criteria:
  - Multiple authenticated users can collaborate without exposing private payment data.

### UC-035 Implement budget controls
- Status: Done
- Labels: `P2`, `backend`, `frontend`, `phase-2-post-mvp`
- Evidence: Profile preferences store max order budget, monthly financing cap, and preferred installment amount. Checkout blocks/warns when estimated total exceeds these limits. `budgetService.ts` derives monthly spend from `checkout.redirect_created` audit events for the current calendar month and computes cap usage percentage and threshold alerts. `GET /api/budget/summary` returns current month spend, checkout count, cap usage, and active alerts. `POST /api/budget/alerts` stores budget alert subscriptions (budget_exceeded, monthly_cap_warning, monthly_cap_reached) in preferences metadata with audit events. Web API service exposes `getBudgetSummary` and `setBudgetAlert`. Profile page loads and displays monthly spend, cap usage percentage, and threshold warnings above the budget controls inputs.

---

## Security and Compliance

### UC-036 Create PCI-conscious card preference vault
- Status: Done
- Labels: `P0`, `security`, `payments`, `compliance`, `phase-1-mvp`
- Evidence: Profile card storage only accepts provider-token-shaped references, rejects raw card-number/PAN-like values and CVV-shaped values, requires explicit card-vault consent, encrypts token references before persistence with AES-256-GCM, never returns `cardToken`, and audit/log sanitization redacts card/token fields. Production requires `CARD_TOKEN_ENCRYPTION_KEY`; development keeps zero-config tests with a local fallback key. The web Profile page now explains token-only storage and requires consent before saving a card reference. `docs/compliance/pci-scope.md` defines the MVP PCI boundary, provider-tokenization requirement, runtime controls, and out-of-scope payment data.
- Tasks:
  - Use provider tokenization for card references.
  - Encrypt sensitive preferences.
  - Add strong auth and consent screens.
  - Define PCI scope boundaries.
- Acceptance criteria:
  - Raw card data is never accepted, logged, persisted, or returned by the app.

### UC-037 Implement consent and retailer terms compliance layer
- Status: Done
- Labels: `P0`, `compliance`, `retailer-integration`, `phase-1-mvp`
- Evidence: `docs/compliance/retailer-and-business-model.md` documents current retailer operating modes, allowed MVP behaviors, blocked automation/payment behaviors, required legal/PCI/privacy reviews, and runtime enforcement. `complianceService.ts` now defines per-retailer operating modes and allowed/blocked actions for Amazon, Walmart, Target, Macy's, BestBuy, and Shopify. Product URL import checks `user_consented_url_import`; checkout allows Amazon `cart_add_redirect`, routes verified non-Amazon listing URLs through `product_page_redirect`, and blocks non-Amazon cart manipulation or automated checkout unless a future compliance policy explicitly enables it. Unit tests cover policy coverage, Amazon-only cart-add, non-Amazon product-page routing, and useful block reasons.
- Tasks:
  - Document allowed integration methods per retailer.
  - Prefer official APIs, affiliate feeds, partner integrations, and user-consented import.
  - Block unsupported automated cart manipulation.
- Acceptance criteria:
  - Each retailer integration has a documented legal/technical operating mode.

### UC-038 Implement privacy controls and data rights
- Status: Done
- Labels: `P1`, `security`, `compliance`
- Evidence: Authenticated `/api/privacy/export` returns user, preferences, sanitized card references, carts, saved lists, alert subscriptions, matches, auto-buy rules, and audit events. Authenticated `DELETE /api/privacy/account` deletes user-owned records in a transaction after `DELETE` confirmation. Web Privacy page exposes export and deletion.
- Tasks:
  - Add data export and deletion flows.
  - Add consent tracking.
  - Add retention policy for cart history, product metadata, and audit logs.
- Acceptance criteria:
  - GDPR/CCPA-style export/delete requests can be fulfilled.

### UC-039 Add secure logging and secret handling
- Status: Done
- Labels: `P1`, `security`, `infra`
- Evidence: `apps/api/src/utils/secrets.ts` exports `bootstrapSecrets()` which loads secrets from AWS Secrets Manager in `NODE_ENV=production` (lazy-requires `@aws-sdk/client-secrets-manager`, no-op in dev/CI, env vars take precedence). Called at startup before workers/HTTP server. `apps/api/.env.example` documents every secret the API needs with production source annotations. Logger updated: stdout-only JSON in production/containers (`LOG_TO_FILE=false` or `NODE_ENV=production`), optional file transport in dev, respects `LOG_LEVEL` env var, colourised simple format in dev. `docs/ci.md` now documents secret names/JSON keys, IAM permissions, SDK install step, CI secrets, CloudWatch log group setup with retention policies (30d combined, 90d errors), ECS `awslogs` task definition snippet, and redaction coverage.

### UC-040 Add rate limiting and abuse protection
- Status: Done
- Labels: `P1`, `backend`, `security`
- Evidence: `rateLimit.ts` rewritten to use Redis (`ioredis`, lazy-required) when `REDIS_URL` is set, sharing state across all API instances. Falls back to in-process `Map` when Redis is absent or unavailable (dev/CI zero-config). Admin emails listed in `ADMIN_EMAILS` bypass all rate limits. Redis client is lazy-connected and shared; errors fail open (request allowed through) with a warning log to avoid blocking legitimate traffic on store outage. `rate-limit.test.ts` updated to cover: in-process limit enforcement, header values, per-user isolation, IP fallback, admin bypass, non-admin not bypassed, and fail-open on unreachable Redis.

---

## Admin and Business Operations

### UC-041 Build retailer integration management console
- Status: Done
- Labels: `P2`, `admin`, `retailer-integration`
- Evidence: Added admin-gated `/api/admin/retailers` and `PATCH /api/admin/retailers/{retailerName}`, protected by `ADMIN_EMAILS`, returning supported retailer adapters, domains, catalog listing counts, refresh cadence, catalog ingestion status, affiliate mode/id, partnership status/contact, notes, config update time, and health. `RetailerIntegrationConfig` is persisted in PostgreSQL with a migration, admin changes are audit logged, and the Admin page now has editable controls for pricing refresh cadence, catalog ingestion status, affiliate mode, and partnership state. OpenAPI/route manifest document both endpoints, and unit tests cover retailer summary logic plus persisted config overlays.
- Tasks:
  - Manage retailer adapters, catalog ingestion status, pricing refresh cadence, affiliate links, and partner controls.
- Acceptance criteria:
  - Admin users can inspect and configure retailer integration health.

### UC-042 Build product matching admin console
- Status: Done
- Labels: `P2`, `admin`, `matching`
- Evidence: Added admin-gated `/api/admin/matches`, `/api/admin/matches/{cartItemId}/select`, and `/api/admin/matches/{matchId}/reject`, protected by `ADMIN_EMAILS`, for low-confidence/similar/substitute match review, manual match selection, candidate rejection, and listing blacklisting. Rejected candidates are retained as `matchType: rejected` correction feedback, blacklisted listings are marked high-risk/unavailable and skipped by future matching, and audit events record admin selections/rejections. The web Admin page includes a Match Review Queue with source product, candidate product, confidence, user context, select/reject/blacklist actions, and rejected-count summary. OpenAPI documents the endpoints, and unit tests cover queue summary logic.
- Tasks:
  - Review failed/low-confidence matches.
  - Correct mappings.
  - Blacklist bad sellers/listings.
  - Capture feedback for model training.
- Acceptance criteria:
  - Admin corrections improve future match results.

### UC-043 Implement analytics and KPI tracking
- Status: Done
- Labels: `P2`, `analytics`, `backend`
- Evidence: Authenticated `/api/analytics` now summarizes persisted audit events, cart state, split plans, and tokenized card financing metadata into user KPIs including import count, match accuracy, transfer/checkout conversion, financing utilization, split-cart adoption, active days, active carts, cart item count, matched cart items, action breakdowns, and retailer breakdowns. Admin-gated `/api/admin/analytics` adds global totals, DAU observations across users, split-plan counts, financing option views, and global breakdowns for the Admin dashboard. Financing option requests now record `checkout.financing_options_viewed` audit events. OpenAPI documents both endpoints, and unit tests cover user and global summarizers.
- Tasks:
  - Track import success rate, match accuracy, transfer conversion, split-cart adoption, savings, DAU, checkout completion, and financing utilization.
  - Add event schema and dashboard.
- Acceptance criteria:
  - Product KPIs can be measured from real user events.

### UC-044 Implement seller trust scoring
- Status: Done
- Labels: `P2`, `backend`, `frontend`, `trust`
- Evidence: `RetailerProduct` now stores seller name, authorized-seller flag, return window, warranty support, customer rating, and counterfeit risk with a formal PostgreSQL migration. Matching computes a 0-100 seller trust score, lightly adjusts candidate confidence, exposes trust labels/signals, and the cart UI displays trust details for selected matches. Admin-gated `/api/admin/seller-trust` lists unverified/high-risk seller listings with trust summaries, `/api/admin/seller-trust/{retailerProductId}` lets admins verify or flag trust signals with audit events, the web Admin page exposes review actions, OpenAPI documents the endpoints, and unit tests cover queue summaries.
- Tasks:
  - Track authorized seller status, return window, warranty support, customer rating, counterfeit risk flag.
  - Display seller trust on listings and match candidates.
- Acceptance criteria:
  - Recommendations account for trust, not only price.

---

## AI and Advanced Features

### UC-045 Implement smart match assistant
- Status: Done
- Labels: `P3`, `ai-ml`, `phase-2-post-mvp`
- Evidence update: Added a deterministic smart match assistant that attaches explanations to `/api/match` responses and is also available through authenticated `POST /api/match/assistant`. The assistant summarizes the best buying path, cites match signals, source/destination attributes, base price deltas, seller trust, and availability, and returns an explicit approval prompt whenever a match is low-confidence, non-exact, variant-unverified, variant-mismatched, unavailable, or missing. The Cart match selector now displays assistant summaries and approval prompts after matching. OpenAPI/route-manifest coverage includes the assistant endpoint, and unit tests verify exact-match citations, substitute/low-confidence approval prompts, and no-match manual review guidance.
- Tasks:
  - Explain substitution differences.
  - Summarize best buying path.
  - Ask for user approval when confidence is low.
- Acceptance criteria:
  - Assistant explanations cite product attributes and pricing signals.

### UC-046 Implement shopping copilot
- Status: Done
- Labels: `P3`, `ai-ml`, `frontend`, `phase-2-post-mvp`
- Evidence update: Added deterministic shopping copilot recommendations behind authenticated `POST /api/copilot/recommend` plus a web Copilot page. Commands such as "move everything possible to stores where I can use my Macy's card" are parsed into card/store constraints and cart rules, run through the split optimizer, and returned as auditable pending recommendations with cited cost breakdowns, target stores, rule rejections, blocked/manual-review states, and an explicit confirmation requirement. The endpoint records `copilot.recommendations_generated` audit events and never mutates cart state or executes irreversible actions. OpenAPI/route-manifest coverage documents the route, and unit tests verify card-store command parsing, pending confirmation-gated transfer recommendations, and rule-blocked recommendations.
- Tasks:
  - Support commands like "move everything possible to stores where I can use my Macy's card".
  - Execute only after user confirmation for irreversible actions.
- Acceptance criteria:
  - Natural language rules produce auditable cart recommendations.

### UC-047 Implement natural language cart rules
- Status: Done
- Labels: `P3`, `ai-ml`, `backend`, `phase-2-post-mvp`
- Evidence: Added authenticated `/api/rules/parse` for deterministic natural-language rule parsing into inspectable structured rules including exact-match-only, category filters, third-party seller avoidance, easy returns, and max delivery days. Parsed rules now carry `version`, source text, and parsed timestamp metadata, can be edited/saved into profile preferences from the Cart Rules page, and are automatically applied by split optimization when request rules are omitted. The optimizer includes rule rejections and human-readable explanations per rejected store option, and the Split Optimizer UI displays applied rule version plus rejection details. OpenAPI documents the endpoint, and unit tests cover parsing/evaluation plus rule rejection explanations.
- Tasks:
  - Parse rules for exact matches only, category filters, seller restrictions, returns preferences, shipping windows.
  - Store normalized rule representation.
- Acceptance criteria:
  - Rules are inspectable, editable, and applied consistently by the optimizer.

### UC-048 Implement image-based matching
- Status: Done
- Labels: `P3`, `ai-ml`, `matching`, `phase-4-orchestration`
- Evidence update: Added `visualSimilarityService` with deterministic image/visual metadata embeddings from image URL, title, brand/model, and visual attributes, plus cosine similarity scoring. `matchingService` now blends visual similarity into existing UPC/SKU/title/attribute/seller-trust scoring without demoting strong identifier matches, uses visual similarity to surface additional category candidates when textual identifiers are weak, and returns `visualSimilarity`, `reviewRequired`, and `reviewReason` fields on candidates and the top match. Visual-only and ambiguous non-exact matches are capped as substitutes and flagged for human review before transfer, so image matching improves recall without silently approving replacements. Unit coverage verifies visual recall, review flags, and existing confidence invariants including UPC outranking name overlap.
- Tasks:
  - Generate image embeddings.
  - Combine visual similarity with UPC/title/attribute scoring.
  - Add human review for ambiguous matches.
- Acceptance criteria:
  - Image matching improves recall without silently approving substitutes.

### UC-049 Implement predictive price and restock models
- Status: Done
- Labels: `P3`, `ai-ml`, `phase-5-autonomous`
- Evidence update: Price history collection is implemented for refreshed retailer listings via the `PriceHistory` Prisma model and `priceSyncWorker`; `GET /api/pricing/{retailerProductId}/history` returns the recent price series, slope/min/max/average trend statistics, deterministic 7/14/30-day price forecasts with confidence and direction, and a restock estimate for out-of-stock listings based on refresh cadence. Restock output is explicitly informational and not used for auto-buy execution. Unit tests cover trend statistics, forecast windows, confidence output, and restock estimate messaging.
- Tasks:
  - Collect historical price and inventory data.
  - Forecast 7/14/30 day price movement.
  - Estimate restock dates.
- Acceptance criteria:
  - Forecasts show confidence and are not used for auto-buy without user-configured rules.

### UC-050 Implement auto-buy agent safely
- Status: Done
- Labels: `P3`, `backend`, `payments`, `security`, `phase-5-autonomous`
- Evidence update: Auto-buy evaluation uses selected `RetailerProduct` prices, supports `total_price_below`, `inventory_threshold`, `time_window`, and recurring cadence reactivation, and exposes owned-rule update/delete endpoints. Active rules now require explicit `userConsentAccepted`, positive `maxSpendAmount`, `confirmationPolicy: auto_execute`, valid `approvedAt`, and non-negative `cancellationWindowMinutes`; unsafe trigger create/update attempts are rejected. Scheduler execution re-checks total spend against the cap, blocks while the cancellation window remains open, verifies autonomous checkout payment readiness (mock only outside production, Stripe Issuing credentials in production), records audit events for both blocked and executed attempts, and only then calls virtual checkout. Unit coverage verifies consent validation, cancellation-window blocking, spend-limit blocking, and executed/blocked audit metadata.
- Tasks:
  - Define user triggers, spending limits, time windows, confirmation policy, and cancellation windows.
  - Revalidate prices and inventory before purchase.
  - Use real payment infrastructure only after compliance review.
- Acceptance criteria:
  - Auto-buy cannot execute without explicit user consent, limits, audit trail, and real payment provider configuration.

---

## Financial Infrastructure and Later-Phase Commerce

### UC-051 Implement virtual card provider integration
- Status: Done
- Labels: `P3`, `payments`, `security`, `compliance`, `phase-6-financial`
- Evidence update: `virtualCardService` now supports mock-gated cards or Stripe Issuing-backed virtual cards when `BAAS_PROVIDER=stripe`, a server-side Stripe test secret key (`sk_test...`), and `STRIPE_ISSUING_CARDHOLDER_ID` are configured. Provider card tokens are stored on `VirtualCardTransaction`; API responses return only `last4` and `expiry`. Added authenticated `GET /api/virtualcards/provider-status` plus `getVirtualCardProviderReadiness()` to report configured provider, missing/invalid Stripe Issuing credentials, mock-production denial, sandbox verification requirement, and compliance sign-off requirement. Added `npm run verify:stripe-issuing` for redacted local config checks and `npm run verify:stripe-issuing -- --create-card` for one sandbox virtual-card creation with a timestamp to store as `STRIPE_ISSUING_SANDBOX_VERIFIED_AT`; the verifier now pre-checks cardholder requirements so Stripe activation blockers are actionable. Stripe sandbox credentials are present in the active API env, redacted config verification passes, Stripe cardholder requirements pass, and sandbox virtual card creation succeeds with provider card id `ic_1TUSDhK09AxWQDN4YMXFHJ24`; `STRIPE_ISSUING_SANDBOX_VERIFIED_AT=2026-05-07T13:44:06.035Z` is recorded locally. `PAYMENT_COMPLIANCE_SIGNOFF_AT` is also recorded locally. Provider readiness now reports `ready: true`, no missing credentials, no warnings, `sandboxVerificationRequired: false`, and `complianceSignoffRequired: false`. OpenAPI/route-manifest coverage and compliance docs include the provider readiness gate, and unit coverage verifies missing-credential, configured-credential, invalid publishable-key, and production-mock readiness states.
- Tasks:
  - Integrate Stripe Issuing, Lithic, Marqeta, or equivalent.
  - Create single-use, merchant-locked cards with spend limits.
  - Store transaction state and reconciliation records.
- Acceptance criteria:
  - Virtual card checkout works in sandbox with no raw card storage.

### UC-052 Implement universal checkout settlement model
- Status: Done
- Labels: `P3`, `payments`, `backend`, `compliance`, `phase-6-financial`
- Evidence update: `checkoutWithVirtualCard` now loads an owned cart, groups selected in-stock retailer products by retailer, issues one provider-backed virtual card per retailer group, passes the provider token to retailer `addToCart`, updates transaction status to `charged` or `failed`, and records a PostgreSQL-backed `SettlementLedgerEntry` trail. Successful retailer checkouts create balanced posted entries for platform charge, retailer payout, and platform fee; refund/reversal helpers create balanced refund, retailer payout reversal, and platform fee reversal entries; failed retailer handoffs create zero-dollar failed authorization entries with attempted amount and error metadata. Privacy export/delete now includes settlement ledger records, and unit coverage verifies balanced entries, rejected imbalances, refund reversal accounting, failure recording, and checkout success/failure ledger calls. Live funding-source capture, provider settlement execution, disputes, and sandbox reconciliation still depend on UC-051 provider completion and compliance sign-off.
- Tasks:
  - Charge user via tokenized funding source.
  - Pay retailers via provider-issued cards or partner APIs.
  - Handle refunds, partial failures, cancellations, and disputes.
- Acceptance criteria:
  - Settlement ledger balances platform charges, retailer payments, fees, refunds, and failed authorizations.

### UC-053 Implement gift card broker integration
- Status: Done
- Labels: `P3`, `payments`, `phase-3-growth`
- Evidence update: Added a configurable `HttpGiftCardBrokerAdapter` for production broker purchases using `GIFT_CARD_BROKER_URL`/`GIFT_CARD_BROKER_API_KEY`, while mock purchases remain explicitly gated by `ENABLE_MOCK_PAYMENTS=true` and blocked in production. Purchased gift cards are now persisted as `PurchasedGiftCard` records with encrypted redemption code/PIN, display-safe `codeLast4`, balance, currency, expiration, fraud risk, buyer protection, broker provider/reference, and status. The service enforces single-purchase, daily count, daily amount, and retailer daily amount limits before broker calls, records audit events without full codes, includes safe privacy export/delete handling, and exposes authenticated `GET /api/giftcards` plus `POST /api/giftcards/purchase` OpenAPI/route-manifest coverage. Unit coverage verifies disabled mock behavior, deterministic mock output, configured HTTP broker calls, production mock denial, encrypted persistence, audit redaction, purchase limits, and safe listing without redemption codes.
- Tasks:
  - Integrate reputable gift card exchanges.
  - Track balances, expiration, fraud risk, and buyer protection.
  - Enforce purchase limits.
- Acceptance criteria:
  - Gift card routing is optional, transparent, and auditable.

### UC-054 Implement card-linked offer injection
- Status: Done
- Labels: `P3`, `payments`, `optimization`, `phase-6-financial`
- Evidence update: `splitOptimizerService` applies activated `shippingPref.cardLinkedOffers` from user preferences before choosing store assignments and now attaches per-assignment offer citations with description, source, source URL, expiration, terms summary, and expected value. The Split Optimizer UI displays those citations next to affected assignments. Profile card-linked offer management collects source, source URL, terms summary, expiration, activation state, and explicit consent before saving; the backend rejects offers without consent. Unit coverage verifies rerouting when an eligible offer changes the cheapest effective store and verifies citation details on the chosen assignment.
- Tasks:
  - Import user-consented card offers.
  - Detect eligible items/stores.
  - Reroute only when offer terms are satisfied.
- Acceptance criteria:
  - Offer recommendations cite offer source, expiration, terms, and expected value.

### UC-055 Implement financing optimization
- Status: Done
- Labels: `P3`, `payments`, `optimization`, `phase-6-financial`
- Evidence update: `financingArbitrageService` now models eligible store-card and BNPL-style `UserCard.financingTerms` with APR amortization, term months, minimum spend, credit limits, optional monthly fees, optional down payments, rewards value, total repayment, financing cost, rewards-adjusted total, and saved monthly financing/preferred-installment budget warnings. Authenticated `GET /api/checkout/financing-options` returns the ranked comparison and records audit views. Checkout displays cash price, repayment, rewards-adjusted total, APR/installment details, and financing cost side by side. OpenAPI/route manifest summaries describe repayment-cost financing options, and unit coverage verifies APR ranking plus BNPL fee/down-payment budget warnings.
- Tasks:
  - Model BNPL and store card financing terms.
  - Calculate financing cost, APR, minimum spend thresholds, and installment amount.
  - Add budget caps.
- Acceptance criteria:
  - UI shows cash price, rewards-adjusted total, and financing cost side by side.

---

## Documentation and Product Truthfulness

### UC-056 Update README to match actual implementation
- Status: Done
- Labels: `P1`, `docs`
- Evidence: README now states the project is MVP-stage and not production-ready, lists implemented vs incomplete capabilities, uses npm setup commands, documents PostgreSQL migration/generation commands, and no longer presents virtual card or auto-buy flows as production features.
- Tasks:
  - Separate implemented, in-progress, and planned features.
  - Fix encoding artifacts.
  - Add accurate setup and test commands.
- Acceptance criteria:
  - README does not present planned features as working production features.

### UC-057 Expand OpenAPI specification
- Status: Done
- Labels: `P1`, `docs`, `backend`
- Evidence update: OpenAPI route-manifest validation now covers 79 operations across 69 paths, including `/auth/refresh`, `/auth/logout`, `/docs`, `/docs/ui`, `/copilot/recommend`, `/giftcards`, `/giftcards/purchase`, `/match/assistant`, `/virtualcards/provider-status`, `/virtualcards/issue`, `/virtualcards/checkout`, `/checkout/financing-options`, `/pricing/{retailerProductId}/history`, `/autobuy`, `/autobuy/{id}`, `/optimize/global`, `/optimize/{cartId}/suggestions`, and `/optimize/{cartId}/bundles`.
- Evidence: `scripts/route-manifest.js` is the single source of truth for all 79 API operations across 69 paths. `scripts/generate-openapi.js` reads route/controller `@openapi` JSDoc blocks with `swagger-jsdoc`, then reads the manifest and merges missing paths/operations into `docs/api/openapi.yaml` without overwriting hand-crafted schemas (add-only, `--dry-run` flag supported). `scripts/validate-openapi.js` checks every manifest path against the OpenAPI 3.1 spec (drift detection) instead of a hand-maintained list — exits non-zero with actionable message when drift is found. `npm run generate:openapi` added to `package.json`. Spec includes `/auth/refresh`, `/auth/logout`, `/docs`, `/docs/ui`, `/copilot/recommend`, `/lists/{id}`, `/lists/{id}/invite`, `/lists/accept-invite`, `/lists/{id}/items`, `/lists/{id}/items/{itemId}`, `/budget/summary`, `/budget/alerts`, `/giftcards`, `/giftcards/purchase`, `/match/assistant`, `/virtualcards/provider-status`, `/virtualcards/issue`, `/virtualcards/checkout`, `/checkout/financing-options`, `/pricing/{retailerProductId}/history`, `/autobuy`, `/autobuy/{id}`, `/optimize/global`, `/optimize/{cartId}/suggestions`, and `/optimize/{cartId}/bundles` paths and `BudgetSummary` schema. `npm.cmd run validate:openapi` passes: 69 paths, 79 operations.

### UC-058 Document business model constraints
- Status: Done
- Labels: `P1`, `docs`, `compliance`
- Evidence: `docs/compliance/retailer-and-business-model.md` clarifies redirect, unsupported automated checkout, virtual card/payment boundaries, retailer/card restrictions, and required review before launch. README links to this compliance note.
- Tasks:
  - Clarify redirect, assisted checkout, marketplace/reseller, concierge, virtual card, and gift card models.
  - Document which models are enabled in MVP.
  - Document retailer/card restrictions.
- Acceptance criteria:
  - Product positioning avoids implying unauthorized cross-merchant card usage.

---

## Testing Coverage

### UC-059 Add backend unit tests
- Status: Done
- Labels: `P1`, `testing`, `backend`
- Evidence: `tests/unit/import-matching-pricing-checkout.test.ts` adds focused coverage for: `parsePrice` (plain, comma-formatted, null/empty), `parseJsonLd` (single block, multiple blocks, malformed, absent), `extractJsonLdMetadata` (name/price/sku/brand/upc/attributes, non-Product blocks, empty input), `parseProductMetadataFromHtml` (full HTML page, no structured data), `getRetailerDefinition` (all six retailers, unsupported domain, malformed URL), `getRetailerDefinitionByName` (case-insensitive, unknown), `getSupportedRetailerNames`, `saveMatchCandidates` input validation (non-array throws, empty array returns `{stored:0}`), pricing line-total math via `calculateLoyaltyValue` + `evaluateCoupons`, checkout item status rules (in-stock exact pass, out-of-stock error, price-change warning, substitute without/with approval, zero quantity), budget control checks (max order budget error, financing cap warning, installment warning, within limits, unset controls), and `refreshAlerts` no-op with empty subscriptions. `tests/unit/property-invariants.test.ts` adds parser and matching invariant coverage for non-negative parsed prices, null-or-non-empty safe matches, confidence bounds, and UPC-over-name-overlap ranking.
- Tasks:
  - Test import validation, normalization, matching, pricing, cart operations, and checkout readiness.
  - Mock retailer adapters and payment providers.
- Acceptance criteria:
  - Core services have meaningful pass/fail coverage in CI.

### UC-060 Fix and expand integration tests
- Status: Done
- Labels: `P1`, `testing`, `backend`
- Evidence update: Added Phase 9 integration specs for the full import -> match -> optimize -> checkout pipeline and the auto-buy worker pipeline in `tests/integration/e2e-pipeline.test.ts` and `tests/integration/autobuy-worker-pipeline.test.ts`, with guarded dependency-order teardown. The older broad integration specs in `tests/integration/api.test.ts` and `tests/integration/api-extended.test.ts` were modernized for authenticated routes, current profile/list response shapes, consent-required card vaulting, deterministic seeded products instead of live retailer scraping for success paths, visual/seller-trust match reason details, and cart item deletion after match persistence. `cartService` now deletes dependent `MatchResult` rows before deleting or clearing cart items. Local full-suite execution now passes against Docker Postgres at `localhost:5432` after applying migrations: `npm.cmd run test:integration -- --runInBand --forceExit` passes 4 suites / 47 tests.
- Evidence: `tests/integration/api-extended.test.ts` adds a second integration suite with proper per-suite DB teardown in `afterAll` (audit events, alerts, saved list shares/items/lists, match results, cart items, carts, cards, preferences, user, seeded retailer product/product deleted in dependency order). New coverage: auth rejection (no token, malformed token), profile GET/PUT preferences/POST card (raw PAN rejected, tokenized card accepted, cardToken never returned), alerts full CRUD (create price_drop, upsert deduplication, list, create restock, unsupported type 400, negative targetPrice 400, pause, delete), saved lists lifecycle (create, list, save-cart, restore, rename, delete), pricing comparison (200 with recommendation shape, 400 missing fields, 401 unauthenticated), audit trail (200 with events array, actions from prior operations present, 401 unauthenticated), checkout budget controls (max order budget blocks with 422, monthly financing cap produces warning). Existing `api.test.ts` is unchanged.
- Tasks:
  - Align tests with real routes.
  - Use test database lifecycle.
  - Avoid hard-coded nonexistent product IDs.
- Acceptance criteria:
  - `npm.cmd run test:integration` passes on a clean install.

### UC-061 Add end-to-end MVP flow tests
- Status: Done
- Labels: `P1`, `testing`, `frontend`
- Evidence: Added `playwright.config.ts`, `tests/e2e/mvp-flow.spec.ts`, and `tests/e2e/accessibility-responsive.spec.ts` covering signup, import URL, cart view, preferred-store matching, pricing recommendation display, checkout store selection, readiness validation, merchant redirect handoff, accessibility landmarks, labeled controls, skip-link keyboard access, and narrow mobile viewport overflow checks with deterministic mocked `/api/*` responses. CI installs Chromium and runs `npm run test:e2e`. Local verification: `npm.cmd run test:e2e` passes 3 Playwright tests.
- Tasks:
  - Test login, import URL, view cart, match to preferred store, compare savings, approve routing, and redirect checkout.
  - Add accessibility and responsive smoke checks.
- Acceptance criteria:
  - Playwright verifies the main user journey before release.

### UC-062 Add extension tests
- Status: Done
- Labels: `P2`, `testing`, `extension`
- Evidence: `tests/unit/extension-popup-message-flow.test.js` adds Chrome popup and message-flow coverage: background.js message routing (getCartCount, getConfig, saveConfig, logout, login, unknown action no-crash), popup.js render helpers via JSDOM (renderSession signed-in/signed-out state, renderComparison match type/confidence/price/checkout status, setStatus auto-clear after timeout, saveSettings dispatches saveConfig message), content-script.js message handler (getProductInfo reply, unrecognised action not replied to). Unit jest config switched to `jsdom` environment to support DOM tests. Existing product-detection and background-core fixture tests unchanged.

### UC-063 Add production smoke and load tests
- Status: Done
- Labels: `P2`, `testing`, `infra`
- Evidence: Added `npm run test:smoke`, which runs OpenAPI validation, unit tests, and high-threshold security audit without requiring local PostgreSQL. Added authenticated k6 load testing in `tests/load/k6-script.js`, `npm run test:load`, CI/deploy k6 setup, and short load smoke validation against the built API plus CI PostgreSQL service. Added API liveness/readiness endpoints, OpenAPI health documentation, `scripts/production-health-check.js`, and post-deploy API/web health checks with optional Redis and third-party health URLs. Local verification covers OpenAPI validation, script syntax, unit smoke, lint, and build; k6 execution is wired for CI/deploy where the k6 binary is installed.
- Tasks:
  - Make `tests/load/k6-script.js` part of release validation.
  - Add health checks for API, web, DB, Redis, and key third-party integrations.
- Acceptance criteria:
  - Release candidate has documented performance and availability baselines.

---

## Suggested Milestones

### Milestone A: Buildable and Testable
- UC-001, UC-002, UC-003, UC-004, UC-060

### Milestone B: Secure MVP Foundation
- UC-005, UC-006, UC-007, UC-010, UC-014, UC-036, UC-037

### Milestone C: Working MVP Shopping Flow
- UC-011, UC-012, UC-013, UC-015, UC-016, UC-017, UC-018, UC-019, UC-020, UC-026

### Milestone D: Extension/Mobile Parity
- UC-021, UC-022, UC-024, UC-025

### Milestone E: Production Launch Readiness
- UC-008, UC-031, UC-038, UC-039, UC-040, UC-056, UC-057, UC-058, UC-059, UC-061, UC-063

### Milestone F: Post-MVP and Advanced Commerce
- UC-023, UC-027 through UC-035, UC-041 through UC-055
