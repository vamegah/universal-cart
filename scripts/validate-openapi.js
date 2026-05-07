#!/usr/bin/env node
/**
 * validate-openapi.js
 *
 * 1. Loads docs/api/openapi.yaml
 * 2. Checks that every path in scripts/route-manifest.js is documented
 * 3. Checks that bearerAuth security scheme is present
 *
 * Exits non-zero on any failure so CI catches spec drift automatically.
 */

const fs = require('fs');
const path = require('path');

let yaml;
try {
  yaml = require('js-yaml');
} catch {
  console.error('js-yaml is required: npm install js-yaml');
  process.exit(1);
}

const { routes } = require('./route-manifest');
const specPath = path.resolve(__dirname, '../docs/api/openapi.yaml');
const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));

let failed = false;

if (spec.openapi !== '3.1.0') {
  console.error(`FAIL: OpenAPI spec must declare openapi: 3.1.0 (found ${spec.openapi || 'missing'})`);
  failed = true;
}

// ── 1. bearer auth ────────────────────────────────────────────────────────────
if (!spec.components?.securitySchemes?.bearerAuth) {
  console.error('FAIL: OpenAPI spec must document bearerAuth security scheme');
  failed = true;
}

// ── 2. path coverage from manifest ───────────────────────────────────────────
const missing = [];
for (const route of routes) {
  const openApiPath = route.path.replace(/:([a-zA-Z_]+)/g, '{$1}');
  if (!spec.paths?.[openApiPath]) {
    missing.push(`${route.method.toUpperCase()} ${openApiPath}`);
  }
}

if (missing.length > 0) {
  console.error(`FAIL: OpenAPI spec is missing ${missing.length} path(s) from route manifest:`);
  missing.forEach((m) => console.error(`  - ${m}`));
  console.error('\nRun: node scripts/generate-openapi.js  to add missing entries.');
  failed = true;
}

// ── 3. result ─────────────────────────────────────────────────────────────────
if (failed) {
  process.exit(1);
}

const uniquePaths = new Set(routes.map((r) => r.path.replace(/:([a-zA-Z_]+)/g, '{$1}')));
console.log(`OpenAPI validation passed — ${uniquePaths.size} paths, ${routes.length} operations covered by manifest.`);
