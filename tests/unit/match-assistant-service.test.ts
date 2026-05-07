/**
 * @jest-environment node
 */

import { describe, expect, it } from '@jest/globals';
import { buildSmartMatchAssistant } from '../../apps/api/src/services/matchAssistantService';

describe('matchAssistantService', () => {
  it('explains exact matches with cited attributes, pricing signals, and trust signals', () => {
    const assistant = buildSmartMatchAssistant(
      {
        name: 'Acme Speaker Blue',
        price: 50,
        attributes: { color: 'Blue', variantKey: 'blue' },
      },
      {
        matchType: 'exact',
        confidence: 0.96,
        reason: 'upc_match; variant_match; seller_trust_90',
        retailerProduct: {
          price: 45,
          inStock: true,
          sellerTrustScore: 90,
          sellerTrustLabel: 'strong',
          sellerTrustSignals: ['authorized seller'],
          product: {
            name: 'Acme Speaker Blue',
            attributes: { color: 'Blue', variantKey: 'blue' },
          },
        },
      }
    );

    expect(assistant).toMatchObject({
      requiresApproval: false,
      citations: {
        pricingSignals: [
          {
            sourcePrice: 50,
            destinationPrice: 45,
            priceDelta: -5,
          },
        ],
        sellerTrust: {
          label: 'strong',
          score: 90,
        },
      },
    });
    expect(assistant.summary).toContain('96% confidence');
    expect(assistant.bestBuyingPath).toContain('checkout revalidation');
    expect(assistant.citations.attributes).toContainEqual(
      expect.objectContaining({ attribute: 'color', source: 'Blue', destination: 'Blue', matches: true })
    );
    expect(assistant.citations.matchSignals).toEqual(['upc_match', 'variant_match', 'seller_trust_90']);
  });

  it('asks for approval on substitute or low-confidence matches', () => {
    const assistant = buildSmartMatchAssistant(
      {
        name: 'Acme Cotton Hoodie',
        price: 40,
        attributes: { color: 'Blue', size: 'M' },
      },
      {
        matchType: 'substitute',
        confidence: 0.64,
        reason: 'category_match; variant_mismatch; seller_trust_60',
        retailerProduct: {
          price: 35,
          inStock: true,
          sellerTrustScore: 60,
          sellerTrustLabel: 'limited',
          product: {
            name: 'Northwind Hoodie',
            attributes: { color: 'Red', size: 'M' },
          },
        },
      }
    );

    expect(assistant.requiresApproval).toBe(true);
    expect(assistant.approvalPrompt).toContain('Approve replacing Acme Cotton Hoodie');
    expect(assistant.bestBuyingPath).toContain('Ask for approval');
    expect(assistant.citations.matchSignals).toContain('variant_mismatch');
  });

  it('explains no-match outcomes as manual review', () => {
    const assistant = buildSmartMatchAssistant({ name: 'Rare Item' }, null);

    expect(assistant).toMatchObject({
      requiresApproval: true,
      approvalPrompt: 'Review manually before replacing this cart item.',
      citations: {
        matchSignals: ['no_match'],
      },
    });
  });
});
