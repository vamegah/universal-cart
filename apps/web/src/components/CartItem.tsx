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
  if (normalized === 'exact') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'close') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (normalized === 'similar' || normalized === 'substitute') return 'border-orange-200 bg-orange-50 text-orange-800';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function CartItem({ item }: Props) {
  const { updateQuantity, removeItem } = useCart();
  const comparison = item.pricingComparison;
  const effectiveSavings = comparison?.recommendation.effectiveSavings;

  return (
    <article className="grid gap-4 px-5 py-4 lg:grid-cols-[88px_minmax(0,1fr)_160px]">
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={item.productName}
          width={88}
          height={88}
          className="h-[88px] w-[88px] rounded-md border border-slate-200 bg-white object-cover"
        />
      ) : (
        <div className="h-[88px] w-[88px] rounded-md bg-slate-100" aria-hidden="true" />
      )}

      <div className="min-w-0 space-y-3">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 font-semibold text-slate-950">{item.productName}</h3>
            <p className="text-sm font-semibold text-slate-950">${item.price.toFixed(2)}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="uc-pill">{item.sourceRetailer}</span>
            {item.category && <span className="uc-pill">{item.category}</span>}
            {item.upc && <span className="uc-pill">UPC {item.upc}</span>}
          </div>
          {item.brand || item.model ? (
            <p className="mt-2 text-sm text-slate-500">
              {[item.brand, item.model].filter(Boolean).join(' / ')}
            </p>
          ) : null}
        </div>

        {item.attributes ? (
          <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            {Object.entries(item.attributes).slice(0, 3).map(([key, value]) => (
              <p key={key} className="rounded-md bg-slate-50 px-2 py-1">
                <span className="font-semibold text-slate-600">{key}:</span> {String(value)}
              </p>
            ))}
          </div>
        ) : null}

        {item.matchedStore ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${matchBadgeClass(item.matchType)}`}>
                {item.matchType || 'none'} match - {formatConfidence(item.confidence)}
              </span>
              <span className="text-xs font-medium text-slate-500">
                Routed to {item.matchedStore}
                {item.matchedPrice != null ? ` at $${item.matchedPrice.toFixed(2)}` : ''}
              </span>
            </div>

            {item.sellerTrustScore != null && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className={item.sellerTrustScore >= 80 ? 'font-semibold text-emerald-700' : item.sellerTrustScore >= 60 ? 'font-semibold text-amber-700' : 'font-semibold text-red-700'}>
                  Seller trust: {item.sellerTrustScore}/100 ({item.sellerTrustLabel || 'review'})
                </p>
                {item.sellerTrustSignals && item.sellerTrustSignals.length > 0 && (
                  <p className="mt-1">{item.sellerTrustSignals.join(', ')}</p>
                )}
              </div>
            )}

            {comparison && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="grid gap-3 sm:grid-cols-2">
                  {comparison.source && (
                    <div>
                      <p className="font-semibold text-slate-900">{comparison.source.retailerName}</p>
                      <p>Total: ${comparison.source.totalBeforeRewards.toFixed(2)}</p>
                      <p>Rewards: -${comparison.source.rewardsValue.toFixed(2)}</p>
                      {comparison.source.loyalty && comparison.source.loyalty.totalValue > 0 && (
                        <p>Loyalty: -${comparison.source.loyalty.totalValue.toFixed(2)}</p>
                      )}
                      {comparison.source.coupons && comparison.source.coupons.estimatedSavings > 0 && (
                        <p>Coupons: ${comparison.source.coupons.estimatedSavings.toFixed(2)} estimated</p>
                      )}
                      <p className="font-semibold">Effective: ${comparison.source.effectiveTotal.toFixed(2)}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">{comparison.destination.retailerName}</p>
                    <p>Total: ${comparison.destination.totalBeforeRewards.toFixed(2)}</p>
                    <p>Rewards: -${comparison.destination.rewardsValue.toFixed(2)}</p>
                    {comparison.destination.loyalty && comparison.destination.loyalty.totalValue > 0 && (
                      <p>Loyalty: -${comparison.destination.loyalty.totalValue.toFixed(2)}</p>
                    )}
                    {comparison.destination.coupons && comparison.destination.coupons.estimatedSavings > 0 && (
                      <p>Coupons: ${comparison.destination.coupons.estimatedSavings.toFixed(2)} estimated</p>
                    )}
                    <p className="font-semibold">Effective: ${comparison.destination.effectiveTotal.toFixed(2)}</p>
                  </div>
                </div>
                {(comparison.source?.coupons?.estimatedSavings || comparison.destination.coupons?.estimatedSavings) ? (
                  <p className="mt-2 text-slate-500">
                    Coupon estimates are excluded from effective totals until confirmed.
                  </p>
                ) : null}
                <p className={effectiveSavings != null && effectiveSavings > 0 ? 'mt-2 font-semibold text-emerald-700' : 'mt-2 font-semibold text-slate-700'}>
                  {comparison.recommendation.explanation}
                </p>
              </div>
            )}

            {item.matchedUrl && (
              <a
                href={item.matchedUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
              >
                View matched product
              </a>
            )}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            No matched product yet.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
        <div className="inline-flex h-10 items-center rounded-md border border-slate-300 bg-white">
          <button
            type="button"
            onClick={() => updateQuantity(item.id, item.quantity - 1)}
            className="grid h-10 w-10 place-items-center text-lg font-semibold text-slate-600 transition hover:bg-slate-50"
            aria-label={`Decrease quantity for ${item.productName}`}
          >
            -
          </button>
          <span className="w-10 text-center text-sm font-semibold text-slate-950">{item.quantity}</span>
          <button
            type="button"
            onClick={() => updateQuantity(item.id, item.quantity + 1)}
            className="grid h-10 w-10 place-items-center text-lg font-semibold text-slate-600 transition hover:bg-slate-50"
            aria-label={`Increase quantity for ${item.productName}`}
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          className="text-sm font-semibold text-red-700 hover:text-red-900"
        >
          Remove
        </button>
      </div>
    </article>
  );
}
