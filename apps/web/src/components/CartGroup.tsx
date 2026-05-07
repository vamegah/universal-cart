import CartItem from '@/components/CartItem';
import { CartGroup as CartGroupType } from '@/utils/cartGrouping';

interface Props {
  group: CartGroupType;
}

export default function CartGroup({ group }: Props) {
  const isDuplicateGroup = group.items.length > 1 || group.sourceRetailers.length > 1;

  return (
    <section className="bg-white rounded-lg shadow overflow-hidden">
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{group.title}</h2>
            <p className="text-sm text-gray-600">
              {group.totalQuantity} item{group.totalQuantity === 1 ? '' : 's'} from {group.sourceRetailers.join(', ')}
            </p>
            {(group.brand || group.model || group.upc) && (
              <p className="text-xs text-gray-500">
                {[group.brand, group.model, group.upc ? `UPC ${group.upc}` : ''].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {isDuplicateGroup && (
              <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
                Grouped duplicate
              </span>
            )}
            <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-700">
              {group.matchedCount}/{group.items.length} matched
            </span>
            {group.bestEffectiveSavings != null && (
              <span className={group.bestEffectiveSavings > 0 ? 'rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700' : 'rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700'}>
                Best savings ${group.bestEffectiveSavings.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="divide-y">
        {group.items.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
