import React from 'react';
import Image from 'next/image';
import { CartItem as CartItemType } from '@/stores/cartStore';
import { useCart } from '@/hooks/useCart';

interface Props {
  item: CartItemType;
}

function formatConfidence(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
  const percent = value <= 1 ? value * 100 : value;
  return `${Math.round(percent)}%`;
}

function matchBadgeClass(matchType?: string) {
  const normalized = (matchType || 'none').toLowerCase();
  if (normalized === 'exact') return 'bg-green-50 text-green-700 border-green-200';
  if (normalized === 'close') return 'bg-yellow-50 text-yellow-800 border-yellow-200';
  if (normalized === 'similar' || normalized === 'substitute') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function CartItem({ item }: Props) {
  const { updateQuantity, removeItem } = useCart();
  const comparison = item.pricingComparison;
  const effectiveSavings = comparison?.recommendation.effectiveSavings;

  return (
    <div className="flex items-center gap-4 border-b py-4">
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={item.productName}
          width={80}
          height={80}
          className="h-20 w-20 rounded object-cover"
        />
      ) : (
        <div className="h-20 w-20 rounded bg-gray-100" aria-hidden="true" />
      )}
      <div className="flex-1">
        <h3 className="font-medium">{item.productName}</h3>
        <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
          {item.sourceRetailer}
        </span>
        {item.brand || item.model ? (
          <p className="text-sm text-gray-500">
            {item.brand}{item.brand && item.model ? ' · ' : ''}{item.model}
          </p>
        ) : null}
        {item.category ? (
          <p className="text-sm text-gray-500">Category: {item.category}</p>
        ) : null}
        {item.upc ? (
          <p className="text-sm text-gray-500">UPC: {item.upc}</p>
        ) : null}
        {item.attributes ? (
          <div className="text-xs text-gray-500 space-y-1 mt-1">
            {Object.entries(item.attributes).slice(0, 3).map(([key, value]) => (
              <p key={key}>
                {key}: {String(value)}
              </p>
            ))}
          </div>
        ) : null}
        <p className="text-sm font-semibold">${item.price.toFixed(2)}</p>
        {item.matchedStore ? (
          <div className="space-y-1">
            <p className="text-xs text-green-600">Matched to: {item.matchedStore}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${matchBadgeClass(item.matchType)}`}>
                {item.matchType || 'none'} match - {formatConfidence(item.confidence)}
              </span>
            </div>
            {item.matchedPrice != null && (
              <p className="text-xs text-gray-500">
                Price: ${item.matchedPrice.toFixed(2)}
              </p>
            )}
            {item.sellerTrustScore != null && (
              <div className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-600">
                <p className={item.sellerTrustScore >= 80 ? 'font-medium text-green-700' : item.sellerTrustScore >= 60 ? 'font-medium text-yellow-700' : 'font-medium text-red-700'}>
                  Seller trust: {item.sellerTrustScore}/100 ({item.sellerTrustLabel || 'review'})
                </p>
                {item.sellerTrustSignals && item.sellerTrustSignals.length > 0 && (
                  <p>{item.sellerTrustSignals.join(', ')}</p>
                )}
              </div>
            )}
            {comparison && (
              <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                <div className="grid gap-2 sm:grid-cols-2">
                  {comparison.source && (
                    <div>
                      <p className="font-medium">{comparison.source.retailerName}</p>
                      <p>Total: ${comparison.source.totalBeforeRewards.toFixed(2)}</p>
                      <p>Rewards: -${comparison.source.rewardsValue.toFixed(2)}</p>
                      {comparison.source.loyalty && comparison.source.loyalty.totalValue > 0 && (
                        <p>Loyalty: -${comparison.source.loyalty.totalValue.toFixed(2)} ({comparison.source.loyalty.details.join(', ')})</p>
                      )}
                      {comparison.source.coupons && comparison.source.coupons.estimatedSavings > 0 && (
                        <p>
                          Coupons: ${comparison.source.coupons.estimatedSavings.toFixed(2)} estimated, $
                          {comparison.source.coupons.appliedSavings.toFixed(2)} applied
                        </p>
                      )}
                      <p>Effective: ${comparison.source.effectiveTotal.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{comparison.destination.retailerName}</p>
                    <p>Total: ${comparison.destination.totalBeforeRewards.toFixed(2)}</p>
                    <p>Rewards: -${comparison.destination.rewardsValue.toFixed(2)}</p>
                    {comparison.destination.loyalty && comparison.destination.loyalty.totalValue > 0 && (
                      <p>Loyalty: -${comparison.destination.loyalty.totalValue.toFixed(2)} ({comparison.destination.loyalty.details.join(', ')})</p>
                    )}
                    {comparison.destination.coupons && comparison.destination.coupons.estimatedSavings > 0 && (
                      <p>
                        Coupons: ${comparison.destination.coupons.estimatedSavings.toFixed(2)} estimated, $
                        {comparison.destination.coupons.appliedSavings.toFixed(2)} applied
                      </p>
                    )}
                    <p>Effective: ${comparison.destination.effectiveTotal.toFixed(2)}</p>
                  </div>
                </div>
                {(comparison.source?.coupons?.estimatedSavings || comparison.destination.coupons?.estimatedSavings) ? (
                  <p className="mt-2 text-gray-500">
                    Coupon estimates are not included in effective totals until confirmed.
                  </p>
                ) : null}
                <p className={effectiveSavings != null && effectiveSavings > 0 ? 'mt-2 font-semibold text-green-700' : 'mt-2 font-semibold text-gray-700'}>
                  {comparison.recommendation.explanation}
                </p>
              </div>
            )}
            {item.matchedUrl && (
              <a
                href={item.matchedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                View product
              </a>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No matched product yet.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateQuantity(item.id, item.quantity - 1)}
          className="px-2 py-1 border rounded"
        >
          -
        </button>
        <span className="w-8 text-center">{item.quantity}</span>
        <button
          onClick={() => updateQuantity(item.id, item.quantity + 1)}
          className="px-2 py-1 border rounded"
        >
          +
        </button>
        <button
          onClick={() => removeItem(item.id)}
          className="ml-4 text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
