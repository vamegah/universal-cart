import { prisma } from '../index';

export interface PriceHistoryPoint {
  price: number;
  recordedAt: Date | string;
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function summarizePriceHistory(points: PriceHistoryPoint[]) {
  if (points.length === 0) {
    return {
      slope: 0,
      min: null,
      max: null,
      average: null,
      direction: 'flat',
    };
  }

  const sorted = [...points].sort(
    (left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime()
  );
  const prices = sorted.map((point) => Number(point.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;

  if (sorted.length === 1) {
    return {
      slope: 0,
      min: round(min),
      max: round(max),
      average: round(average),
      direction: 'flat',
    };
  }

  const startTime = new Date(sorted[0].recordedAt).getTime();
  const xs = sorted.map((point) => (new Date(point.recordedAt).getTime() - startTime) / 86_400_000);
  const xMean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const yMean = average;
  const numerator = xs.reduce((sum, x, index) => sum + (x - xMean) * (prices[index] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  const slope = denominator === 0 ? 0 : numerator / denominator;

  return {
    slope: round(slope),
    min: round(min),
    max: round(max),
    average: round(average),
    direction: slope > 0.01 ? 'rising' : slope < -0.01 ? 'falling' : 'flat',
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function latestPoint(points: PriceHistoryPoint[]) {
  return [...points].sort(
    (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime()
  )[0] || null;
}

export function forecastPriceWindows(points: PriceHistoryPoint[], windows = [7, 14, 30]) {
  const trend = summarizePriceHistory(points);
  const latest = latestPoint(points);
  if (!latest || points.length < 2 || trend.average == null) {
    return windows.map((days) => ({
      days,
      predictedPrice: latest ? round(Number(latest.price)) : null,
      expectedChange: 0,
      confidence: points.length === 1 ? 0.25 : 0,
      direction: 'flat',
    }));
  }

  const newestAt = new Date(latest.recordedAt).getTime();
  const oldestAt = Math.min(...points.map((point) => new Date(point.recordedAt).getTime()));
  const spanDays = Math.max(1, (newestAt - oldestAt) / 86_400_000);
  const recencyDays = Math.max(0, (Date.now() - newestAt) / 86_400_000);
  const sampleScore = clamp(points.length / 8, 0.2, 1);
  const spanScore = clamp(spanDays / 30, 0.2, 1);
  const recencyScore = clamp(1 - recencyDays / 45, 0.2, 1);
  const confidence = round(sampleScore * spanScore * recencyScore);

  return windows.map((days) => {
    const expectedChange = trend.slope * days;
    const predictedPrice = Math.max(0, Number(latest.price) + expectedChange);
    return {
      days,
      predictedPrice: round(predictedPrice),
      expectedChange: round(expectedChange),
      confidence,
      direction: expectedChange > 0.5 ? 'rising' : expectedChange < -0.5 ? 'falling' : 'flat',
    };
  });
}

export function estimateRestockWindow(
  listing: { inStock?: boolean; lastUpdated?: Date | string | null } | null,
  points: PriceHistoryPoint[]
) {
  if (!listing) return null;
  if (listing.inStock !== false) {
    return {
      status: 'in_stock',
      estimatedRestockAt: null,
      confidence: 1,
      basis: 'current listing is in stock',
    };
  }

  const lastUpdated = listing.lastUpdated ? new Date(listing.lastUpdated) : null;
  const historySpanDays = points.length > 1
    ? (new Date(latestPoint(points)!.recordedAt).getTime() - Math.min(...points.map((point) => new Date(point.recordedAt).getTime()))) / 86_400_000
    : 0;
  const cadenceDays = points.length > 1 ? clamp(historySpanDays / (points.length - 1), 3, 21) : 14;
  const baseTime = lastUpdated?.getTime() || Date.now();
  const estimatedRestockAt = new Date(baseTime + cadenceDays * 86_400_000).toISOString();
  const confidence = points.length >= 4 ? 0.45 : points.length >= 2 ? 0.3 : 0.2;

  return {
    status: 'out_of_stock',
    estimatedRestockAt,
    confidence,
    basis: 'estimated from listing refresh cadence; not used for auto-buy execution',
  };
}

export async function getRetailerProductPriceHistory(retailerProductId: string, days = 90) {
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  const [listing, history] = await Promise.all([
    prisma.retailerProduct.findUnique({
      where: { id: retailerProductId },
      select: { id: true, inStock: true, lastUpdated: true },
    }),
    prisma.priceHistory.findMany({
    where: {
      retailerProductId,
      recordedAt: { gte: since },
    },
    orderBy: { recordedAt: 'asc' },
    }),
  ]);

  return {
    retailerProductId,
    days,
    history,
    trend: summarizePriceHistory(history),
    forecasts: forecastPriceWindows(history),
    restockEstimate: estimateRestockWindow(listing, history),
  };
}
