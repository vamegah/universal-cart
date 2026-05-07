import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

const navGroups = [
  {
    label: 'Commerce',
    items: [
      { href: '/', label: 'Dashboard' },
      { href: '/cart', label: 'Cart' },
      { href: '/checkout', label: 'Checkout' },
      { href: '/shipping', label: 'Shipping' },
      { href: '/rules', label: 'Rules' },
    ],
  },
  {
    label: 'Growth',
    items: [
      { href: '/lists', label: 'Lists' },
      { href: '/alerts', label: 'Alerts' },
      { href: '/copilot', label: 'Copilot' },
      { href: '/analytics', label: 'Analytics' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: '/admin', label: 'Admin' },
      { href: '/audit', label: 'Audit' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/profile', label: 'Preferences' },
      { href: '/account', label: 'Account' },
    ],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  function isActive(href: string) {
    if (href === '/') return router.pathname === '/';
    return router.pathname === href || router.pathname.startsWith(`${href}/`);
  }

  return (
    <div className="uc-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-cyan-700 focus:shadow"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="uc-container flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-sm font-bold text-white">
              UC
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-950">Universal Cart</span>
              <span className="block truncate text-xs text-slate-500">Enterprise commerce console</span>
            </span>
          </Link>
          <div className="hidden items-center gap-3 md:flex">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Sandbox ready
            </span>
            <Link href="/checkout" className="uc-button-primary">
              Review checkout
            </Link>
          </div>
        </div>
      </header>

      <div className="uc-container grid gap-6 py-6 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="Primary" className="sticky top-[5.5rem] space-y-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="uc-label mb-2 px-2">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition ${
                          active
                            ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                            : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                        }`}
                      >
                        {item.label}
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-cyan-600" aria-hidden="true" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 overflow-hidden lg:hidden">
          <nav aria-label="Primary" className="flex w-full gap-2 overflow-x-auto pb-1">
            {navGroups.flatMap((group) => group.items).map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    active ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main id="main-content" tabIndex={-1} className="min-w-0 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
