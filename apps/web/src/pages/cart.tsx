import Cart from '@/components/Cart';

export default function CartPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <p className="uc-label">Cart Operations</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
          Universal cart review
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Validate grouped items, matching confidence, retailer routing, and total cost before checkout.
        </p>
      </section>
      <Cart />
    </div>
  );
}
