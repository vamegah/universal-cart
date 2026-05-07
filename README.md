# Universal Cart & Checkout Optimizer

Universal Cart is an MVP-stage shopping platform for importing products from supported retailers, matching them to preferred merchant listings, comparing effective cost after estimated shipping/tax/rewards, and routing users to supported merchant checkout paths.

This repository is buildable and the tracked readiness board is fully implemented. See [.github/ISSUE_BOARD.md](.github/ISSUE_BOARD.md) for the live readiness tracker and verification evidence.

## Current Implementation

- Next.js web app with account, profile, cart, matching, pricing comparison, and checkout routing screens.
- Express API with signed bearer-token auth, persisted session rotation/revocation, scrypt password hashing, server-backed cart persistence, profile/card reward preferences, retailer import, matching, pricing comparison, checkout validation/routing, and gated mock payment behavior.
- Prisma configured for PostgreSQL with migration files and production lookup indexes.
- Retailer adapter registry for Amazon, Walmart, Target, Macy's, Best Buy, and Shopify/generic supported URLs.
- Browser extension defaults to the API on `http://localhost:3001/api`, supports backend login/session storage, and can compare/import detected product pages.
- Mobile has login/signup/session handling, configurable API endpoint, authenticated cart/import/profile/alert flows, and checkout split-plan display.
- Stripe Issuing sandbox verification and payment compliance sign-off gates are wired for virtual card readiness.
- CI workflow provisions PostgreSQL, applies migrations, builds, runs unit/integration/e2e/load smoke validation, OpenAPI validation, and high-threshold security audit.

## Production Launch Notes

- Final launch still requires environment-specific deploy checks and live vendor/account approvals.
- Non-Amazon multi-item cart prebuild remains intentionally unsupported unless a merchant-approved integration is added.
- Gift card purchases require a configured production broker.
- `npm audit` may report upstream Next/PostCSS advisories without an available fix in the installed Next 15.5.x tree; the configured high-threshold production audit passes.

## Tech Stack

- Web: Next.js, React, Tailwind CSS
- API: Node.js, Express, Prisma
- Database: PostgreSQL
- Mobile: Flutter scaffold
- Extension: Chrome Manifest V3 scaffold
- Tests: Jest/Supertest integration tests, Playwright scaffold

## Prerequisites

- Node.js 18+
- npm 11+
- Docker Desktop with Compose for local PostgreSQL

## Setup

```bash
npm install
```

Create API environment values:

```bash
cp apps/api/.env.example apps/api/.env
```

If `.env.example` is not present in your checkout, create `apps/api/.env` with:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/universal_cart
AUTH_SECRET=replace-with-a-long-random-secret
ENABLE_MOCK_PAYMENTS=false
```

Start local PostgreSQL:

```bash
docker compose up -d postgres redis
```

Apply migrations and generate Prisma client:

```bash
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx prisma generate --schema apps/api/prisma/schema.prisma
```

Verify Stripe Issuing sandbox configuration when working on virtual card checkout:

```bash
npm run verify:stripe-issuing
npm run verify:stripe-issuing -- --create-card
```

Run the apps:

```bash
npm run dev
```

Default URLs:

- Web: http://localhost:3000
- API: http://localhost:3001
- API health: http://localhost:3001/health

## CI and Deploys

CI and deploy validation use npm, PostgreSQL 15, Prisma migrations, build, tests, OpenAPI validation, audit, and smoke checks. Deploy workflows are gated by the same validation job before AWS deployment steps run. See `docs/ci.md` for required environment variables, service containers, and deploy secrets.

## Compliance Notes

The MVP supports user-consented import, matching, comparison, and redirect-style routing. It does not perform unauthorized checkout automation or cross-merchant card charging. See [docs/compliance/retailer-and-business-model.md](docs/compliance/retailer-and-business-model.md) for retailer operating modes and payment boundaries.

## Verification

```bash
npm run build
npm run test:unit
npm run test:integration
npm run test:smoke
npm run security:audit
```

Local integration tests require PostgreSQL to be running. If Docker Desktop is not available, build verification can still pass, but database-backed tests and migrations cannot be verified locally.

## Repository Layout

```text
apps/api          Express API and Prisma schema
apps/web          Next.js web app
apps/extension    Browser extension scaffold
apps/mobile       Flutter mobile scaffold
packages/*        Shared packages
tests             Integration, e2e, and load test scaffolds
.github           CI workflow and production readiness issue board
```
