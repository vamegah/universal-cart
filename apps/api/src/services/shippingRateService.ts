/**
 * Shipping rate estimator.
 *
 * Provides realistic flat-rate estimates by default.
 * In production, set CARRIER_RATE_PROVIDER=ups|fedex|usps and supply the
 * corresponding API credentials — the provider factory below will swap in
 * a real implementation without changing call sites.
 *
 * Estimate tiers (ground, no weight data available):
 *   subtotal >= 50  → free (most retailers)
 *   subtotal >= 25  → $4.99
 *   subtotal <  25  → $6.99
 *   expedited       → +$8.00
 *   overnight       → +$18.00
 */

export type ShippingSpeed = 'standard' | 'expedited' | 'overnight';

export interface RateRequest {
  retailerName: string;
  subtotal: number;       // item price × quantity
  speed?: ShippingSpeed;
  weightLbs?: number;     // optional — improves estimate accuracy
  destinationZip?: string; // optional — for zone-based pricing
}

export interface RateEstimate {
  retailerName: string;
  speed: ShippingSpeed;
  cost: number;
  etaDays: number;
  isFree: boolean;
  source: 'estimate' | 'carrier_api';
}

// ─── default estimator ────────────────────────────────────────────────────────

function defaultEstimate(req: RateRequest): RateEstimate {
  const speed = req.speed ?? 'standard';
  let base = 0;

  if (req.subtotal >= 50) {
    base = 0;
  } else if (req.subtotal >= 25) {
    base = 4.99;
  } else {
    base = 6.99;
  }

  // Weight surcharge when provided.
  if (req.weightLbs && req.weightLbs > 5) {
    base += Math.ceil((req.weightLbs - 5) / 5) * 1.5;
  }

  let surcharge = 0;
  let etaDays = 5;
  if (speed === 'expedited') { surcharge = 8; etaDays = 2; }
  if (speed === 'overnight')  { surcharge = 18; etaDays = 1; }

  // Amazon Prime-style: always 2-day standard.
  if (req.retailerName.toLowerCase() === 'amazon') {
    etaDays = speed === 'overnight' ? 1 : speed === 'expedited' ? 1 : 2;
  }

  const cost = Math.max(0, base + surcharge);
  return {
    retailerName: req.retailerName,
    speed,
    cost: Math.round(cost * 100) / 100,
    etaDays,
    isFree: cost === 0,
    source: 'estimate',
  };
}

// ─── provider factory (extensible) ───────────────────────────────────────────

type RateProvider = (req: RateRequest) => Promise<RateEstimate>;

function buildProvider(): RateProvider {
  const provider = process.env.CARRIER_RATE_PROVIDER?.toLowerCase();

  if (provider === 'ups' || provider === 'fedex' || provider === 'usps') {
    // Real carrier integration placeholder.
    // Replace the body below with the actual SDK call when credentials are
    // configured. The function signature must remain identical.
    return async (req) => {
      // TODO: call carrier SDK with process.env.CARRIER_API_KEY
      // Fall back to estimate until implemented.
      return defaultEstimate(req);
    };
  }

  return async (req) => defaultEstimate(req);
}

const getRate: RateProvider = buildProvider();

export async function estimateShippingRate(req: RateRequest): Promise<RateEstimate> {
  return getRate(req);
}

export async function estimateShippingRates(
  requests: RateRequest[]
): Promise<RateEstimate[]> {
  return Promise.all(requests.map(estimateShippingRate));
}
