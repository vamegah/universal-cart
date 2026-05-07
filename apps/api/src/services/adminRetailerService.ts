import { prisma } from '../index';
import { getRetailerDefinitionByName, getRetailerDefinitions } from '../integrations/registry';

const PRICING_REFRESH_CADENCES = new Set(['manual_or_import_triggered', 'hourly', 'daily', 'weekly', 'paused']);
const CATALOG_INGESTION_STATUSES = new Set(['manual', 'scheduled', 'paused', 'blocked']);
const AFFILIATE_MODES = new Set(['not_configured', 'manual_links', 'network_feed', 'partner_api']);
const PARTNERSHIP_STATUSES = new Set(['unverified', 'outreach', 'contracting', 'partnered', 'blocked']);

type RetailerConfig = {
  retailerName: string;
  pricingRefreshCadence?: string;
  catalogIngestionStatus?: string;
  affiliateMode?: string;
  affiliateId?: string | null;
  partnershipStatus?: string;
  partnerContactEmail?: string | null;
  notes?: string | null;
  updatedAt?: Date | string;
};

function normalizeRetailerName(value: string) {
  const definition = getRetailerDefinitionByName(value);
  if (!definition) throw new Error('Unsupported retailer');
  return definition.name;
}

function pickEnum(value: unknown, allowed: Set<string>, fallback: string, fieldName: string) {
  if (value == null || value === '') return fallback;
  const normalized = String(value);
  if (!allowed.has(normalized)) {
    throw new Error(`${fieldName} must be one of ${Array.from(allowed).join(', ')}`);
  }
  return normalized;
}

function optionalString(value: unknown) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function configByRetailer(configs: RetailerConfig[]) {
  return new Map(configs.map((config) => [config.retailerName.toLowerCase(), config]));
}

export function summarizeRetailerIntegrations(
  definitions: Array<{ name: string; domains: string[]; adapter: unknown }>,
  counts: Array<{ retailerName: string; _count: { _all: number } }>,
  configs: RetailerConfig[] = [],
  staleThresholdHours = 24
) {
  const countByRetailer = new Map(counts.map((entry) => [entry.retailerName.toLowerCase(), entry._count._all]));
  const configLookup = configByRetailer(configs);

  return definitions.map((definition) => {
    const config = configLookup.get(definition.name.toLowerCase());
    const catalogListingCount = countByRetailer.get(definition.name.toLowerCase()) || 0;
    const catalogIngestionStatus = config?.catalogIngestionStatus || 'manual';
    const health = !definition.adapter
      ? 'missing_adapter'
      : catalogIngestionStatus === 'blocked'
        ? 'blocked'
        : catalogIngestionStatus === 'paused'
          ? 'paused'
          : catalogListingCount === 0
            ? 'configured_no_catalog'
            : 'configured';

    return {
      name: definition.name,
      domains: definition.domains,
      adapterConfigured: Boolean(definition.adapter),
      catalogListingCount,
      pricingRefreshCadence: config?.pricingRefreshCadence || 'manual_or_import_triggered',
      catalogIngestionStatus,
      affiliateMode: config?.affiliateMode || 'not_configured',
      affiliateId: config?.affiliateId || null,
      partnershipStatus: config?.partnershipStatus || 'unverified',
      partnerContactEmail: config?.partnerContactEmail || null,
      notes: config?.notes || null,
      configUpdatedAt: config?.updatedAt ? new Date(config.updatedAt).toISOString() : null,
      staleThresholdHours,
      health,
    };
  });
}

export async function getRetailerIntegrationOverview() {
  const [counts, configs] = await Promise.all([
    prisma.retailerProduct.groupBy({
      by: ['retailerName'],
      _count: { _all: true },
    }),
    (prisma as any).retailerIntegrationConfig.findMany(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    retailers: summarizeRetailerIntegrations(getRetailerDefinitions(), counts, configs),
  };
}

export async function updateRetailerIntegrationConfig(retailerNameInput: string, input: Record<string, unknown>) {
  const retailerName = normalizeRetailerName(retailerNameInput);
  const data = {
    pricingRefreshCadence: pickEnum(
      input.pricingRefreshCadence,
      PRICING_REFRESH_CADENCES,
      'manual_or_import_triggered',
      'pricingRefreshCadence'
    ),
    catalogIngestionStatus: pickEnum(
      input.catalogIngestionStatus,
      CATALOG_INGESTION_STATUSES,
      'manual',
      'catalogIngestionStatus'
    ),
    affiliateMode: pickEnum(input.affiliateMode, AFFILIATE_MODES, 'not_configured', 'affiliateMode'),
    affiliateId: optionalString(input.affiliateId),
    partnershipStatus: pickEnum(input.partnershipStatus, PARTNERSHIP_STATUSES, 'unverified', 'partnershipStatus'),
    partnerContactEmail: optionalString(input.partnerContactEmail),
    notes: optionalString(input.notes),
  };

  return (prisma as any).retailerIntegrationConfig.upsert({
    where: { retailerName },
    create: { retailerName, ...data },
    update: data,
  });
}
