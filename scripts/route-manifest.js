/**
 * Route manifest — single source of truth for every API route.
 *
 * The generate-openapi.js script reads this file and merges each entry into
 * docs/api/openapi.yaml, adding any missing paths/operations.
 *
 * The validate-openapi.js script checks that every path listed here exists in
 * the spec, catching drift when new routes are added without updating the spec.
 *
 * Fields:
 *   path        — Express-style path (e.g. /lists/{id}/items)
 *   method      — HTTP method (lowercase)
 *   auth        — true = requires bearerAuth, false = public
 *   summary     — short description (used as OpenAPI summary)
 *   tags        — OpenAPI tags array
 *   requestBody — optional inline schema fragment
 *   responses   — map of status code → description
 */

/** @type {Array<import('./openapi-types').RouteEntry>} */
const routes = [
  // ── health ──────────────────────────────────────────────────────────────────
  { path: '/health/live',  method: 'get',  auth: false, summary: 'API liveness check',  tags: ['health'], responses: { 200: 'API process is accepting requests' } },
  { path: '/health/ready', method: 'get',  auth: false, summary: 'API readiness check', tags: ['health'], responses: { 200: 'API is ready', 503: 'API degraded' } },
  { path: '/docs',         method: 'get',  auth: false, summary: 'Download the generated OpenAPI document', tags: ['docs'], responses: { 200: 'OpenAPI YAML document' } },
  { path: '/docs/ui',      method: 'get',  auth: false, summary: 'View interactive API documentation',      tags: ['docs'], responses: { 200: 'Swagger UI HTML' } },

  // ── auth ────────────────────────────────────────────────────────────────────
  { path: '/auth/signup', method: 'post', auth: false, summary: 'Create an account', tags: ['auth'], responses: { 201: 'Account created', 400: 'Validation error', 409: 'Email taken' } },
  { path: '/auth/login',  method: 'post', auth: false, summary: 'Log in',            tags: ['auth'], responses: { 200: 'Authenticated', 401: 'Invalid credentials' } },
  { path: '/auth/me',     method: 'get',  auth: true,  summary: 'Get current user',  tags: ['auth'], responses: { 200: 'Current user', 401: 'Unauthenticated' } },
  { path: '/auth/refresh', method: 'post', auth: true, summary: 'Rotate the current persisted session token', tags: ['auth'], responses: { 200: 'Session refreshed', 401: 'Unauthenticated' } },
  { path: '/auth/logout', method: 'post', auth: true, summary: 'Revoke the current persisted client session', tags: ['auth'], responses: { 204: 'Logged out', 401: 'Unauthenticated' } },

  // ── profile ─────────────────────────────────────────────────────────────────
  { path: '/profile',              method: 'get',    auth: true, summary: 'Get preferences and card reward references', tags: ['profile'], responses: { 200: 'Profile' } },
  { path: '/profile/preferences',  method: 'put',    auth: true, summary: 'Upsert shopping preferences',               tags: ['profile'], responses: { 200: 'Preferences saved' } },
  { path: '/profile/cards',        method: 'post',   auth: true, summary: 'Add a tokenized card reward reference',     tags: ['profile'], responses: { 201: 'Card added', 400: 'Invalid card' } },
  { path: '/profile/cards/{id}',   method: 'delete', auth: true, summary: 'Delete a card reward reference',           tags: ['profile'], responses: { 204: 'Deleted', 404: 'Not found' } },

  // ── import ──────────────────────────────────────────────────────────────────
  { path: '/import/url', method: 'post', auth: true, summary: 'Import a product from a supported retailer URL', tags: ['import'], responses: { 200: 'Product imported', 400: 'Invalid URL', 422: 'Unsupported retailer' } },
  { path: '/import/search', method: 'post', auth: true, summary: 'Search supported retailers by keyword', tags: ['import'], responses: { 200: 'Search results', 400: 'Invalid query', 422: 'Unsupported retailer' } },

  // ── cart ────────────────────────────────────────────────────────────────────
  { path: '/cart',                    method: 'get',    auth: true, summary: 'Get or create the active cart',  tags: ['cart'], responses: { 200: 'Active cart' } },
  { path: '/cart',                    method: 'delete', auth: true, summary: 'Clear the active cart',          tags: ['cart'], responses: { 200: 'Items removed' } },
  { path: '/cart/items',              method: 'post',   auth: true, summary: 'Add a product to the cart',      tags: ['cart'], responses: { 200: 'Item added' } },
  { path: '/cart/items/{id}/quantity',method: 'put',    auth: true, summary: 'Update cart item quantity',      tags: ['cart'], responses: { 200: 'Updated' } },
  { path: '/cart/items/{id}',         method: 'delete', auth: true, summary: 'Remove a cart item',             tags: ['cart'], responses: { 204: 'Removed' } },

  // ── lists ───────────────────────────────────────────────────────────────────
  { path: '/lists',                        method: 'get',    auth: true, summary: 'List saved reusable carts',                  tags: ['lists'], responses: { 200: 'Saved lists' } },
  { path: '/lists',                        method: 'post',   auth: true, summary: 'Create an empty saved list',                 tags: ['lists'], responses: { 201: 'Created' } },
  { path: '/lists/from-cart',              method: 'post',   auth: true, summary: 'Save active cart as a reusable list',        tags: ['lists'], responses: { 201: 'Saved' } },
  { path: '/lists/accept-invite',          method: 'post',   auth: true, summary: 'Accept a saved list invite token',           tags: ['lists'], responses: { 200: 'Invite accepted', 400: 'Validation error', 404: 'Not found' } },
  { path: '/lists/{id}',                   method: 'get',    auth: true, summary: 'Get one saved list',                         tags: ['lists'], responses: { 200: 'Saved list', 404: 'Not found' } },
  { path: '/lists/{id}',                   method: 'put',    auth: true, summary: 'Rename a saved list',                        tags: ['lists'], responses: { 200: 'Renamed', 404: 'Not found' } },
  { path: '/lists/{id}',                   method: 'delete', auth: true, summary: 'Delete a saved list',                        tags: ['lists'], responses: { 204: 'Deleted' } },
  { path: '/lists/{id}/restore',           method: 'post',   auth: true, summary: 'Restore saved list into active cart',        tags: ['lists'], responses: { 200: 'Restored' } },
  { path: '/lists/{id}/share',             method: 'post',   auth: true, summary: 'Share a saved list with an existing user',   tags: ['lists'], responses: { 201: 'Shared', 404: 'Not found' } },
  { path: '/lists/{id}/invite',            method: 'post',   auth: true, summary: 'Create a saved list invite token',           tags: ['lists'], responses: { 201: 'Invite created', 400: 'Validation error', 404: 'Not found' } },
  { path: '/lists/{id}/share/{shareId}',   method: 'delete', auth: true, summary: 'Remove a saved list share',                  tags: ['lists'], responses: { 204: 'Removed' } },
  { path: '/lists/{id}/items',             method: 'post',   auth: true, summary: 'Add an item to a saved list',                tags: ['lists'], responses: { 201: 'Item added', 200: 'Item quantity incremented', 400: 'Validation error', 404: 'Not found' } },
  { path: '/lists/{id}/items/{itemId}',    method: 'patch',  auth: true, summary: 'Update a saved list item quantity',          tags: ['lists'], responses: { 200: 'Updated', 400: 'Validation error', 404: 'Not found' } },
  { path: '/lists/{id}/items/{itemId}',    method: 'delete', auth: true, summary: 'Remove an item from a saved list',           tags: ['lists'], responses: { 204: 'Removed', 404: 'Not found' } },

  // ── alerts ──────────────────────────────────────────────────────────────────
  { path: '/alerts',      method: 'get',    auth: true, summary: 'List alert subscriptions',                          tags: ['alerts'], responses: { 200: 'Alert subscriptions' } },
  { path: '/alerts',      method: 'post',   auth: true, summary: 'Create or update an alert subscription',            tags: ['alerts'], responses: { 201: 'Created', 200: 'Updated', 400: 'Validation error', 404: 'Product not found' } },
  { path: '/alerts/{id}', method: 'patch',  auth: true, summary: 'Update alert subscription status or target price',  tags: ['alerts'], responses: { 200: 'Updated', 404: 'Not found' } },
  { path: '/alerts/{id}', method: 'delete', auth: true, summary: 'Delete an alert subscription',                      tags: ['alerts'], responses: { 204: 'Deleted' } },

  // ── budget ──────────────────────────────────────────────────────────────────
  { path: '/budget/summary', method: 'get',  auth: true, summary: 'Get monthly spend summary and budget alerts', tags: ['budget'], responses: { 200: 'Budget summary' } },
  { path: '/budget/alerts',  method: 'post', auth: true, summary: 'Subscribe to a budget threshold alert',       tags: ['budget'], responses: { 201: 'Alert set', 400: 'Validation error' } },

  // Shopping copilot
  { path: '/copilot/recommend', method: 'post', auth: true, summary: 'Generate auditable pending shopping copilot recommendations', tags: ['copilot'], responses: { 200: 'Copilot recommendations', 400: 'Validation error' } },

  // Gift cards
  { path: '/giftcards', method: 'get', auth: true, summary: 'List purchased gift cards with balance and risk metadata', tags: ['giftcards'], responses: { 200: 'Purchased gift cards' } },
  { path: '/giftcards/purchase', method: 'post', auth: true, summary: 'Purchase a tracked gift card when a broker is configured', tags: ['giftcards'], responses: { 201: 'Gift card purchased', 400: 'Validation error', 503: 'Gift card broker unavailable' } },

  // ── match ───────────────────────────────────────────────────────────────────
  { path: '/match',            method: 'post', auth: true, summary: 'Generate a match for a product at a preferred store', tags: ['match'], responses: { 200: 'Match result', 404: 'No match found' } },
  { path: '/match/assistant',  method: 'post', auth: true, summary: 'Explain a match recommendation with cited product, pricing, and trust signals', tags: ['match'], responses: { 200: 'Match explanation', 400: 'Validation error' } },
  { path: '/match/select',     method: 'post', auth: true, summary: 'Persist selected match for a cart item',              tags: ['match'], responses: { 200: 'Match selected' } },
  { path: '/match/candidates', method: 'post', auth: true, summary: 'Persist match candidates for a cart item',            tags: ['match'], responses: { 200: 'Candidates saved' } },

  // ── pricing ─────────────────────────────────────────────────────────────────
  { path: '/pricing/compare',                    method: 'post', auth: true, summary: 'Compare source and destination effective totals', tags: ['pricing'], responses: { 200: 'Pricing comparison', 400: 'Validation error', 404: 'Not found' } },
  { path: '/pricing/{retailerProductId}/history', method: 'get',  auth: true, summary: 'Get retailer product price history and trend', tags: ['pricing'], responses: { 200: 'Price history', 400: 'Validation error' } },

  // ── optimize / shipping / rules ─────────────────────────────────────────────
  { path: '/optimize',          method: 'post', auth: true, summary: 'Build a split-cart optimization plan',                    tags: ['optimize'],  responses: { 200: 'Split plan' } },
  { path: '/optimize/global',   method: 'post', auth: true, summary: 'Build a global split-cart optimization plan',             tags: ['optimize'],  responses: { 200: 'Global split plan', 400: 'Validation error' } },
  { path: '/optimize/{cartId}/suggestions', method: 'get', auth: true, summary: 'Get split-plan threshold unlock suggestions', tags: ['optimize'], responses: { 200: 'Threshold suggestions', 404: 'Not found' } },
  { path: '/optimize/{cartId}/bundles',     method: 'get', auth: true, summary: 'Get cross-retailer bundle suggestions',       tags: ['optimize'], responses: { 200: 'Bundle suggestions', 404: 'Not found' } },
  { path: '/shipping/optimize', method: 'post', auth: true, summary: 'Compare shipping consolidation plans',                    tags: ['shipping'],  responses: { 200: 'Shipping plans', 400: 'Validation error' } },
  { path: '/rules/parse',       method: 'post', auth: true, summary: 'Parse natural-language cart rules into structured rules', tags: ['rules'],     responses: { 200: 'Parsed rules', 400: 'Validation error' } },

  // ── checkout ────────────────────────────────────────────────────────────────
  { path: '/checkout/stores',   method: 'get',  auth: true, summary: 'List supported checkout stores',              tags: ['checkout'], responses: { 200: 'Supported stores' } },
  { path: '/checkout/stores',   method: 'post', auth: true, summary: 'Get checkout support status per store',       tags: ['checkout'], responses: { 200: 'Store statuses' } },
  { path: '/checkout/financing-options', method: 'get', auth: true, summary: 'List eligible financing options with repayment costs', tags: ['checkout'], responses: { 200: 'Financing options', 400: 'Validation error' } },
  { path: '/checkout/validate', method: 'post', auth: true, summary: 'Validate checkout readiness',                 tags: ['checkout'], responses: { 200: 'Ready', 422: 'Not ready' } },
  { path: '/checkout/redirect', method: 'post', auth: true, summary: 'Create a supported merchant redirect URL',   tags: ['checkout'], responses: { 200: 'Redirect URL', 422: 'Unsupported' } },

  // Virtual cards
  { path: '/virtualcards/provider-status', method: 'get', auth: true, summary: 'Check virtual card provider readiness and sandbox gates', tags: ['virtualcards'], responses: { 200: 'Provider readiness status' } },
  { path: '/virtualcards/issue',    method: 'post', auth: true, summary: 'Issue a merchant-limited virtual card', tags: ['virtualcards'], responses: { 201: 'Virtual card issued', 400: 'Validation error', 503: 'Provider unavailable' } },
  { path: '/virtualcards/checkout', method: 'post', auth: true, summary: 'Checkout a cart with provider virtual cards', tags: ['virtualcards'], responses: { 200: 'Virtual checkout result', 400: 'Validation error', 503: 'Provider unavailable' } },

  // Auto-buy
  { path: '/autobuy',      method: 'get',    auth: true, summary: 'List auto-buy rules',     tags: ['autobuy'], responses: { 200: 'Auto-buy rules' } },
  { path: '/autobuy',      method: 'post',   auth: true, summary: 'Create an auto-buy rule', tags: ['autobuy'], responses: { 201: 'Rule created', 400: 'Validation error', 404: 'Cart not found' } },
  { path: '/autobuy/{id}', method: 'patch',  auth: true, summary: 'Update an auto-buy rule', tags: ['autobuy'], responses: { 200: 'Rule updated', 400: 'Validation error', 404: 'Not found' } },
  { path: '/autobuy/{id}', method: 'delete', auth: true, summary: 'Delete an auto-buy rule', tags: ['autobuy'], responses: { 204: 'Rule deleted', 404: 'Not found' } },

  // ── audit / analytics ───────────────────────────────────────────────────────
  { path: '/audit',     method: 'get', auth: true, summary: "List current user's audit events",          tags: ['audit'],     responses: { 200: 'Audit events' } },
  { path: '/analytics', method: 'get', auth: true, summary: "Get current user's MVP analytics summary",  tags: ['analytics'], responses: { 200: 'Analytics summary' } },

  // ── admin ───────────────────────────────────────────────────────────────────
  { path: '/admin/retailers',                method: 'get',  auth: true, summary: 'Admin retailer integration health overview', tags: ['admin'], responses: { 200: 'Retailer overview', 403: 'Forbidden' } },
  { path: '/admin/retailers/{retailerName}', method: 'patch', auth: true, summary: 'Admin updates retailer integration configuration', tags: ['admin'], responses: { 200: 'Retailer configuration updated', 400: 'Validation error', 403: 'Forbidden', 404: 'Not found' } },
  { path: '/admin/matches',                  method: 'get',  auth: true, summary: 'Admin low-confidence match review queue',    tags: ['admin'], responses: { 200: 'Match queue', 403: 'Forbidden' } },
  { path: '/admin/analytics',                method: 'get',  auth: true, summary: 'Admin global analytics and KPI dashboard',   tags: ['admin'], responses: { 200: 'Global analytics', 403: 'Forbidden' } },
  { path: '/admin/seller-trust',             method: 'get',  auth: true, summary: 'Admin seller trust review queue',            tags: ['admin'], responses: { 200: 'Seller trust queue', 403: 'Forbidden' } },
  { path: '/admin/seller-trust/{retailerProductId}', method: 'patch', auth: true, summary: 'Admin updates seller trust signals', tags: ['admin'], responses: { 200: 'Seller trust listing updated', 400: 'Validation error', 403: 'Forbidden', 404: 'Not found' } },
  { path: '/admin/matches/{cartItemId}/select', method: 'post', auth: true, summary: 'Admin manually selects a match',         tags: ['admin'], responses: { 200: 'Match selected', 403: 'Forbidden', 404: 'Not found' } },
  { path: '/admin/matches/{matchId}/reject', method: 'post', auth: true, summary: 'Admin rejects a match candidate or blacklists listing', tags: ['admin'], responses: { 200: 'Match rejected', 403: 'Forbidden', 404: 'Not found' } },

  // ── privacy ─────────────────────────────────────────────────────────────────
  { path: '/privacy/export',  method: 'get',    auth: true, summary: "Export current user's account data",   tags: ['privacy'], responses: { 200: 'Data export' } },
  { path: '/privacy/account', method: 'delete', auth: true, summary: "Delete current user's account data",  tags: ['privacy'], responses: { 200: 'Account deleted' } },
];

module.exports = { routes };
