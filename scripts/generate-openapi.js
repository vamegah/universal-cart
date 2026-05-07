#!/usr/bin/env node
/**
 * generate-openapi.js
 *
 * Reads scripts/route-manifest.js and merges any missing paths/operations
 * into docs/api/openapi.yaml.  Existing hand-crafted entries are preserved —
 * the script only ADDS, never overwrites.
 *
 * Usage:
 *   node scripts/generate-openapi.js          # merge missing entries
 *   node scripts/generate-openapi.js --dry-run # print diff without writing
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

let swaggerJSDoc;
try {
  swaggerJSDoc = require('swagger-jsdoc');
} catch {
  console.error('swagger-jsdoc is required: npm install swagger-jsdoc');
  process.exit(1);
}

const { routes } = require('./route-manifest');
const specPath = path.resolve(__dirname, '../docs/api/openapi.yaml');
const isDryRun = process.argv.includes('--dry-run');

const spec = yaml.load(fs.readFileSync(specPath, 'utf8'));
spec.openapi = '3.1.0';
spec.paths = spec.paths || {};

let added = 0;

const jsdocSpec = swaggerJSDoc({
  definition: {
    openapi: '3.1.0',
    info: spec.info,
    components: spec.components,
  },
  apis: [
    path.resolve(__dirname, '../apps/api/src/routes/**/*.ts'),
    path.resolve(__dirname, '../apps/api/src/controllers/**/*.ts'),
  ],
});

for (const [openApiPath, pathItem] of Object.entries(jsdocSpec.paths || {})) {
  if (!spec.paths[openApiPath]) {
    spec.paths[openApiPath] = {};
  }

  for (const [method, operation] of Object.entries(pathItem)) {
    if (spec.paths[openApiPath][method]) {
      continue;
    }

    spec.paths[openApiPath][method] = operation;
    added++;
    console.log(`  + ${method.toUpperCase()} ${openApiPath} (JSDoc)`);
  }
}

for (const route of routes) {
  const { path: routePath, method, auth, summary, tags, responses } = route;

  // Normalise path params: Express :id → OpenAPI {id}
  const openApiPath = routePath.replace(/:([a-zA-Z_]+)/g, '{$1}');

  if (!spec.paths[openApiPath]) {
    spec.paths[openApiPath] = {};
  }

  if (spec.paths[openApiPath][method]) {
    // Already documented — skip to preserve hand-crafted detail.
    continue;
  }

  const operation = {
    summary,
    tags,
    responses: buildResponses(responses),
  };

  if (!auth) {
    operation.security = [];
  }

  // Add path parameters for any {param} segments.
  const paramMatches = [...openApiPath.matchAll(/\{([^}]+)\}/g)];
  if (paramMatches.length > 0) {
    operation.parameters = paramMatches.map(([, name]) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
  }

  spec.paths[openApiPath][method] = operation;
  added++;
  console.log(`  + ${method.toUpperCase()} ${openApiPath}`);
}

if (added === 0) {
  console.log('OpenAPI spec is already up to date — no paths added.');
} else {
  console.log(`\nAdded ${added} operation(s).`);
}

if (!isDryRun) {
  fs.writeFileSync(specPath, yaml.dump(spec, { lineWidth: 120, noRefs: true }));
  console.log(`Wrote ${specPath}`);
} else {
  console.log('Dry run — spec not written.');
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildResponses(responseMap) {
  const out = {};
  for (const [code, description] of Object.entries(responseMap)) {
    if (Number(code) >= 400) {
      out[String(code)] = { $ref: '#/components/responses/Error' };
    } else {
      out[String(code)] = { description };
    }
  }
  return out;
}
