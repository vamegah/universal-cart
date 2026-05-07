export type RetailerAction =
  | 'user_consented_url_import'
  | 'catalog_search'
  | 'cart_add_redirect'
  | 'product_page_redirect'
  | 'automated_checkout';

export interface RetailerCompliancePolicy {
  retailerName: string;
  operatingMode: string;
  allowedActions: RetailerAction[];
  blockedActions: RetailerAction[];
  notes: string;
}

const policies: RetailerCompliancePolicy[] = [
    {
      retailerName: 'Amazon',
      operatingMode: 'User-consented URL import and ASIN add-to-cart redirect',
      allowedActions: ['user_consented_url_import', 'catalog_search', 'cart_add_redirect', 'product_page_redirect'],
      blockedActions: ['automated_checkout'],
      notes: 'Amazon cart-add redirects require item identifiers and still hand off final checkout to Amazon.',
    },
    {
      retailerName: 'Walmart',
      operatingMode: 'User-consented URL import and verified product-page routing',
      allowedActions: ['user_consented_url_import', 'catalog_search', 'product_page_redirect'],
      blockedActions: ['cart_add_redirect', 'automated_checkout'],
      notes: 'Multi-item cart prebuild and automated checkout are blocked until a formal integration is approved.',
    },
    {
      retailerName: 'Target',
      operatingMode: 'User-consented URL import and verified product-page routing',
      allowedActions: ['user_consented_url_import', 'product_page_redirect'],
      blockedActions: ['cart_add_redirect', 'automated_checkout'],
      notes: 'Target cart manipulation is blocked; users complete checkout on verified product pages.',
    },
    {
      retailerName: "Macy's",
      operatingMode: 'User-consented URL import and verified product-page routing',
      allowedActions: ['user_consented_url_import', 'product_page_redirect'],
      blockedActions: ['cart_add_redirect', 'automated_checkout'],
      notes: "Macy's card usage is represented only as user preference/reward context, not universal payment settlement.",
    },
    {
      retailerName: 'BestBuy',
      operatingMode: 'User-consented URL import and verified product-page routing',
      allowedActions: ['user_consented_url_import', 'product_page_redirect'],
      blockedActions: ['cart_add_redirect', 'automated_checkout'],
      notes: 'Credentialed cart sync and automated checkout are blocked.',
    },
    {
      retailerName: 'Shopify',
      operatingMode: 'User-consented URL import and verified product-page routing',
      allowedActions: ['user_consented_url_import', 'product_page_redirect'],
      blockedActions: ['cart_add_redirect', 'automated_checkout'],
      notes: 'Generic Shopify checkout automation varies by merchant and remains blocked by default.',
    },
];

const policyByRetailer = new Map<string, RetailerCompliancePolicy>(
  policies.map((policy) => [policy.retailerName.toLowerCase(), policy])
);

export function getRetailerCompliancePolicy(retailerName: string) {
  return policyByRetailer.get(retailerName.toLowerCase()) || null;
}

export function getRetailerCompliancePolicies() {
  return Array.from(policyByRetailer.values()).map((policy) => ({
    ...policy,
    allowedActions: [...policy.allowedActions],
    blockedActions: [...policy.blockedActions],
  }));
}

export function isRetailerActionAllowed(retailerName: string, action: RetailerAction) {
  const policy = getRetailerCompliancePolicy(retailerName);
  if (!policy) return false;
  return policy.allowedActions.includes(action) && !policy.blockedActions.includes(action);
}

export function getRetailerActionBlockReason(retailerName: string, action: RetailerAction) {
  const policy = getRetailerCompliancePolicy(retailerName);
  if (!policy) return `No compliance policy is configured for ${retailerName}.`;
  return `${action} is not allowed for ${policy.retailerName}. ${policy.notes}`;
}
