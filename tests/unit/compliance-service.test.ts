import { describe, expect, it } from '@jest/globals';
import {
  getRetailerActionBlockReason,
  getRetailerCompliancePolicies,
  getRetailerCompliancePolicy,
  isRetailerActionAllowed,
} from '../../apps/api/src/services/complianceService';

describe('complianceService retailer policy enforcement', () => {
  it('documents a runtime policy for every supported MVP retailer', () => {
    const names = getRetailerCompliancePolicies().map((policy) => policy.retailerName);

    expect(names).toEqual(expect.arrayContaining(['Amazon', 'Walmart', 'Target', "Macy's", 'BestBuy', 'Shopify']));
    for (const policy of getRetailerCompliancePolicies()) {
      expect(policy.operatingMode).toBeTruthy();
      expect(policy.allowedActions).toContain('user_consented_url_import');
      expect(policy.blockedActions).toContain('automated_checkout');
    }
  });

  it('allows Amazon cart-add redirects but blocks non-Amazon cart manipulation by default', () => {
    expect(isRetailerActionAllowed('Amazon', 'cart_add_redirect')).toBe(true);
    expect(isRetailerActionAllowed('Walmart', 'cart_add_redirect')).toBe(false);
    expect(isRetailerActionAllowed('Target', 'cart_add_redirect')).toBe(false);
    expect(isRetailerActionAllowed("Macy's", 'cart_add_redirect')).toBe(false);
    expect(isRetailerActionAllowed('BestBuy', 'cart_add_redirect')).toBe(false);
    expect(isRetailerActionAllowed('Shopify', 'cart_add_redirect')).toBe(false);
  });

  it('allows verified product-page redirects for supported non-Amazon retailers', () => {
    expect(isRetailerActionAllowed('Walmart', 'product_page_redirect')).toBe(true);
    expect(isRetailerActionAllowed('Target', 'product_page_redirect')).toBe(true);
    expect(isRetailerActionAllowed("Macy's", 'product_page_redirect')).toBe(true);
    expect(isRetailerActionAllowed('BestBuy', 'product_page_redirect')).toBe(true);
    expect(isRetailerActionAllowed('Shopify', 'product_page_redirect')).toBe(true);
  });

  it('returns a useful block reason for unsupported actions', () => {
    expect(getRetailerCompliancePolicy('Walmart')?.operatingMode).toContain('verified product-page');
    expect(getRetailerActionBlockReason('Walmart', 'cart_add_redirect')).toContain('not allowed');
  });
});
