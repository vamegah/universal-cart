import http from 'k6/http';
import { check, fail, sleep } from 'k6';

const apiBaseUrl = (__ENV.K6_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const smokeMode = __ENV.K6_SMOKE === 'true';
const virtualUsers = Number(__ENV.K6_VUS || (smokeMode ? 3 : 20));
const runId = __ENV.K6_RUN_ID || `${Date.now()}`;
const password = __ENV.K6_TEST_PASSWORD || 'load-test-password';

export const options = {
  stages: smokeMode
    ? [
        { duration: '5s', target: virtualUsers },
        { duration: '10s', target: virtualUsers },
        { duration: '5s', target: 0 },
      ]
    : [
        { duration: __ENV.K6_RAMP_UP || '30s', target: virtualUsers },
        { duration: __ENV.K6_DURATION || '1m', target: virtualUsers },
        { duration: __ENV.K6_RAMP_DOWN || '10s', target: 0 },
      ],
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: [`p(95)<${Number(__ENV.K6_P95_MS || (smokeMode ? 1000 : 500))}`],
  },
};

function api(path) {
  return `${apiBaseUrl}${path}`;
}

function jsonHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

function getToken() {
  if (__ENV.K6_AUTH_TOKEN) {
    return __ENV.K6_AUTH_TOKEN;
  }

  const email =
    __ENV.K6_TEST_EMAIL ||
    `load-${runId}-${__VU}-${__ITER}@example.com`;
  const credentials = JSON.stringify({ email, password });
  const signup = http.post(api('/api/auth/signup'), credentials, jsonHeaders());

  if (signup.status === 201) {
    return signup.json('token');
  }

  if (signup.status === 409 || signup.status === 400) {
    const login = http.post(api('/api/auth/login'), credentials, jsonHeaders());
    if (check(login, { 'login succeeded': (response) => response.status === 200 && Boolean(response.json('token')) })) {
      return login.json('token');
    }
  }

  fail(`Unable to authenticate load-test user: signup returned ${signup.status}`);
}

export default function () {
  const live = http.get(api('/health/live'), { tags: { name: 'GET /health/live' } });
  check(live, {
    'liveness is ok': (response) => response.status === 200 && response.json('status') === 'ok',
  });

  const ready = http.get(api('/health/ready'), { tags: { name: 'GET /health/ready' } });
  check(ready, {
    'readiness is ok': (response) => response.status === 200 && response.json('status') === 'ok',
    'database check is ok': (response) => response.json('checks.database.status') === 'ok',
  });

  const token = getToken();
  const headers = jsonHeaders(token);

  const cart = http.get(api('/api/cart'), { ...headers, tags: { name: 'GET /api/cart' } });
  check(cart, {
    'cart is readable': (response) => response.status === 200 && Array.isArray(response.json('items')),
  });

  const checkoutItem = {
    productId: 'load-test-product',
    productName: 'Load Test Product',
    retailerSku: 'B000LOAD01',
    sourceRetailer: 'Amazon',
    sourceUrl: 'https://www.amazon.com/dp/B000LOAD01',
    price: 49.99,
    quantity: 1,
  };

  const stores = http.post(
    api('/api/checkout/stores'),
    JSON.stringify({ items: [checkoutItem] }),
    { ...headers, tags: { name: 'POST /api/checkout/stores' } }
  );
  check(stores, {
    'checkout store status succeeds': (response) => response.status === 200 && Array.isArray(response.json('supportedStores')),
  });

  const validation = http.post(
    api('/api/checkout/validate'),
    JSON.stringify({ items: [checkoutItem], store: 'Amazon' }),
    { ...headers, tags: { name: 'POST /api/checkout/validate' } }
  );
  check(validation, {
    'checkout validation succeeds': (response) => response.status === 200 && response.json('ready') === true,
  });

  const redirect = http.post(
    api('/api/checkout/redirect'),
    JSON.stringify({ items: [checkoutItem], store: 'Amazon' }),
    { ...headers, tags: { name: 'POST /api/checkout/redirect' } }
  );
  check(redirect, {
    'checkout redirect succeeds': (response) => response.status === 200 && String(response.json('redirectUrl')).includes('amazon.com'),
  });

  sleep(Number(__ENV.K6_SLEEP_SECONDS || 1));
}
