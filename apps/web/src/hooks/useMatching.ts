import { useState } from 'react';
import { compareCartItemPricing, matchProduct, saveMatchSelection, saveMatchCandidates } from '@/services/api';
import { useCartStore } from '@/stores/cartStore';

export function useMatching() {
  const { items, setMatch, setPricingComparison } = useCartStore();
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  const [matches, setMatches] = useState<Record<string, any>>({});

  const matchAllItems = async (preferredStore: string) => {
    setMatchingInProgress(true);
    const newMatches: Record<string, any> = {};
    for (const item of items) {
      try {
        const matchResult = await matchProduct(item, preferredStore);
        newMatches[item.id] = matchResult;
        setMatch(
          item.id,
          preferredStore,
          matchResult.retailerProduct?.id || '',
          matchResult.matchType || 'none',
          matchResult.confidence || 0,
          matchResult.retailerProduct?.price,
          matchResult.retailerProduct?.url,
          matchResult.retailerProduct?.sellerTrustScore,
          matchResult.retailerProduct?.sellerTrustLabel,
          matchResult.retailerProduct?.sellerTrustSignals
        );

        if (matchResult.retailerProduct?.id) {
          if (item.id && Array.isArray(matchResult.candidates)) {
            await saveMatchCandidates(
              item.id,
              matchResult.candidates.map((candidate: any) => ({
                retailerProductId: candidate.retailerProduct?.id,
                matchType: candidate.matchType,
                confidence: candidate.confidence,
                reason: candidate.reason,
              })),
              matchResult.retailerProduct.id
            );
          }

          await saveMatchSelection(
            item.id,
            matchResult.retailerProduct.id,
            matchResult.matchType || 'none',
            matchResult.confidence || 0
          );

          try {
            const pricingComparison = await compareCartItemPricing(item.id, matchResult.retailerProduct.id);
            setPricingComparison(item.id, pricingComparison);
          } catch (pricingError) {
            console.error(`Failed to compare pricing for item ${item.id}`, pricingError);
          }
        }
      } catch (err) {
        console.error(`Failed to match item ${item.id}`, err);
        newMatches[item.id] = { matchType: 'none', confidence: 0, retailerProduct: null };
        setMatch(item.id, preferredStore, '', 'none', 0);
      }
    }
    setMatches(newMatches);
    setMatchingInProgress(false);
    return newMatches;
  };

  return { matchAllItems, matchingInProgress, matches };
}
