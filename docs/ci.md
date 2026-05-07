# CI and Deploy Validation

The canonical package manager is npm. CI and deploy validation use `npm ci` from the repository root.

## Pull Request and Push CI

`.github/workflows/ci.yml` runs on pull requests, pushes to `main` and `master`, and manual dispatch.

Required service containers:

- PostgreSQL 15, exposed on `localhost:5432`

CI environment variables:

- `DATABASE_URL=postgresql://postgres:password@localhost:5432/universal_cart`
- `NODE_ENV=test`
- `AUTH_SECRET=ci-auth-secret`

Validation steps:

- Install dependencies with `npm ci`
- Generate the Prisma client
- Apply PostgreSQL migrations
- Run workspace lint
- Build all workspaces
- Run unit tests
- Run integration tests
- Install Chromium for Playwright
- Run Playwright e2e smoke tests
- Validate OpenAPI
- Run high-threshold security audit
- Install k6
- Run a short k6 load smoke test against the built API and CI PostgreSQL service
- Run production smoke checks

The e2e smoke tests run the real Next.js UI and mock browser `/api/*` calls, so they verify the authenticated MVP UI journey without relying on live retailer pages or seeded catalog data. The suite also includes accessibility and responsive smoke checks for landmarks, labeled controls, skip-link keyboard access, and narrow mobile viewport overflow.

The load smoke test starts `@universal-cart/api` locally, waits for `/health/ready`, and runs `tests/load/k6-script.js` with `K6_SMOKE=true`. The k6 script exercises liveness, readiness/database checks, signup/login, authenticated cart reads, checkout store support, checkout readiness, and supported Amazon redirect generation without live retailer scraping.

## Deploy Gates

`deploy-api.yml` and `deploy-web.yml` both start with the same validation gate. Deployment jobs use `needs: validate`, so deployment does not run unless build, tests, OpenAPI validation, audit, and smoke checks pass first.

API deploy additionally requires these secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `API_HEALTH_URL` as either a repository variable or secret for the post-rollout deployed API readiness check

Web deploy additionally requires:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `CLOUDFRONT_DIST_ID`
- `NEXT_PUBLIC_API_URL` as either a repository variable or secret
- `WEB_HEALTH_URL` as either a repository variable or secret for the post-deploy web availability check
- Optional `THIRD_PARTY_HEALTH_URLS` as comma-separated `name=url` entries for additional deployed dependency checks

Web deploy builds with `NEXT_OUTPUT=export` and uploads `apps/web/out/` to S3. Because the static export cannot rely on Next rewrites, `NEXT_PUBLIC_API_URL` must point at the deployed API base URL.

## Secret Store Strategy

All sensitive values are kept out of source control. The canonical secret store for production is **AWS Secrets Manager**.

### Secret names and contents

| Secret name | JSON keys | Used by |
|---|---|---|
| `universal-cart/database` | `DATABASE_URL` | API, Prisma |
| `universal-cart/auth` | `AUTH_SECRET` | API auth middleware |
| `universal-cart/smtp` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Alert email notifications |
| `universal-cart/stripe` | `STRIPE_SECRET_KEY` | Phase 6 virtual card (disabled until configured) |
| `universal-cart/retailer-keys` | `AMAZON_PA_API_KEY`, `WALMART_API_KEY` | Retailer import adapters |

### How secrets are loaded

`apps/api/src/utils/secrets.ts` exports `bootstrapSecrets()`, which is called at startup before workers or the HTTP server start. In `NODE_ENV=production` it fetches each secret from Secrets Manager and injects missing keys into `process.env`. Environment variables already set in the task definition take precedence (env wins over Secrets Manager). In development and CI, `bootstrapSecrets()` is a no-op — secrets come from `.env` files.

Required IAM permission for the ECS task role:
```
secretsmanger:GetSecretValue on arn:aws:secretsmanager:<region>:<account>:secret:universal-cart/*
```

Install the SDK in the API workspace before deploying:
```bash
npm install @aws-sdk/client-secrets-manager --workspace @universal-cart/api
```

### CI secrets

CI does not use Secrets Manager. The following GitHub Actions secrets are required:

- `DATABASE_URL` — CI PostgreSQL connection string
- `AUTH_SECRET` — any non-empty string for test token signing
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — deploy jobs only
- `CLOUDFRONT_DIST_ID` — web deploy only
- `NEXT_PUBLIC_API_URL` — web deploy only
- `API_HEALTH_URL` / `WEB_HEALTH_URL` — post-deploy health checks

## Log Retention Policy

### Development

When `LOG_TO_FILE=true` (the default in dev), Winston writes `error.log` and `combined.log` to the API working directory. These files are git-ignored and have no automated rotation. Set `LOG_RETENTION_DAYS` in `.env` as a reminder; manual cleanup is expected.

### Production (containers / ECS)

Set `NODE_ENV=production` or `LOG_TO_FILE=false`. The logger emits structured JSON to **stdout only**. The container runtime forwards stdout to **Amazon CloudWatch Logs**.

Recommended CloudWatch configuration:

| Log group | Retention |
|---|---|
| `/universal-cart/api` | 30 days |
| `/universal-cart/api/errors` | 90 days |

Create the log groups with retention policies before first deploy:
```bash
aws logs create-log-group --log-group-name /universal-cart/api
aws logs put-retention-policy --log-group-name /universal-cart/api --retention-in-days 30

aws logs create-log-group --log-group-name /universal-cart/api/errors
aws logs put-retention-policy --log-group-name /universal-cart/api/errors --retention-in-days 90
```

The ECS task definition `logConfiguration` should use the `awslogs` driver:
```json
{
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/universal-cart/api",
    "awslogs-region": "us-east-1",
    "awslogs-stream-prefix": "api"
  }
}
```

Sensitive fields (`authorization`, `password`, `token`, `cardToken`, `cardNumber`, `cvv`, `cvc`, `pan`, `secret`) are redacted by the logger's `redactFormat` before any log entry is emitted.
