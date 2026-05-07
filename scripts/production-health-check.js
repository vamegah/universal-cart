const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 10_000);

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function addBaseCheck(checks, label, baseUrl, path) {
  if (baseUrl) {
    checks.push({ label, url: joinUrl(baseUrl, path) });
  }
}

function parseThirdPartyChecks(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        return { label: `Third-party ${index + 1}`, url: entry };
      }

      return {
        label: entry.slice(0, separatorIndex).trim() || `Third-party ${index + 1}`,
        url: entry.slice(separatorIndex + 1).trim(),
      };
    });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json,text/html,text/plain' },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runCheck({ label, url }) {
  if (!url) {
    return { label, skipped: true, reason: 'No URL configured' };
  }

  const response = await fetchWithTimeout(url);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 120);
  }

  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${response.statusText} from ${url}`);
  }

  if (body && typeof body === 'object' && body.status && !['ok', 'healthy'].includes(String(body.status).toLowerCase())) {
    throw new Error(`${label} reported unhealthy status "${body.status}" from ${url}`);
  }

  return {
    label,
    url,
    status: response.status,
    body,
  };
}

async function main() {
  const checks = [];
  const requireApi = process.env.REQUIRE_API_HEALTH_URL === 'true';
  const requireWeb = process.env.REQUIRE_WEB_HEALTH_URL === 'true';

  if (process.env.API_HEALTH_URL) {
    checks.push({ label: 'API readiness', url: process.env.API_HEALTH_URL });
  } else {
    addBaseCheck(checks, 'API readiness', process.env.API_BASE_URL, '/health/ready');
  }

  if (process.env.WEB_HEALTH_URL) {
    checks.push({ label: 'Web availability', url: process.env.WEB_HEALTH_URL });
  } else {
    addBaseCheck(checks, 'Web availability', process.env.WEB_BASE_URL, '/');
  }

  if (process.env.REDIS_HEALTH_URL) {
    checks.push({ label: 'Redis health', url: process.env.REDIS_HEALTH_URL });
  }

  checks.push(...parseThirdPartyChecks(process.env.THIRD_PARTY_HEALTH_URLS));

  if (requireApi && !checks.some((check) => check.label === 'API readiness')) {
    throw new Error('API_HEALTH_URL or API_BASE_URL must be configured for deployed API health checks.');
  }

  if (requireWeb && !checks.some((check) => check.label === 'Web availability')) {
    throw new Error('WEB_HEALTH_URL or WEB_BASE_URL must be configured for deployed web health checks.');
  }

  if (checks.length === 0) {
    console.log('No production health URLs configured; skipping deployed health checks.');
    return;
  }

  const results = [];
  for (const check of checks) {
    results.push(await runCheck(check));
  }

  for (const result of results) {
    console.log(`${result.label}: ${result.status} ${result.url}`);
  }
  console.log('Production health checks passed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
