import CartItem from '@/components/CartItem';
import { CartGroup as CartGroupType } from '@/utils/cartGrouping';

interface Props {
  group: CartGroupType;
}

export default function CartGroup({ group }: Props) {
  const isDuplicateGroup = group.items.length > 1 || group.sourceRetailers.length > 1;

  return (
    <section className="uc-panel overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-950">{group.title}</h2>
            <p className="text-sm text-slate-600">
              {group.totalQuantity} item{group.totalQuantity === 1 ? '' : 's'} from {group.sourceRetailers.join(', ')}
            </p>
            {(group.brand || group.model || group.upc) && (
              <p className="text-xs text-slate-500">
                {[group.brand, group.model, group.upc ? `UPC ${group.upc}` : ''].filter(Boolean).join(' / ')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {isDuplicateGroup && (
              <span className="uc-pill border-cyan-200 bg-cyan-50 text-cyan-700">
                Grouped duplicate
              </span>
            )}
            <span className="uc-pill border-emerald-200 bg-emerald-50 text-emerald-700">
              {group.matchedCount}/{group.items.length} matched
            </span>
            {group.bestEffectiveSavings != null && (
              <span className={group.bestEffectiveSavings > 0 ? 'uc-pill border-emerald-200 bg-emerald-50 text-emerald-700' : 'uc-pill'}>
                Best savings ${group.bestEffectiveSavings.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-200">
        {group.items.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
