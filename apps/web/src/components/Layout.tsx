import React from 'react';
import Link from 'next/link';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-blue-700 focus:shadow"
      >
        Skip to main content
      </a>
      <header className="bg-white shadow-sm border-b">
        <nav
          aria-label="Primary"
          className="container mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <Link href="/" className="text-xl font-bold text-blue-600">
            Universal Cart
          </Link>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm sm:text-base">
            <Link href="/" className="text-gray-700 hover:text-blue-600">
              Home
            </Link>
            <Link href="/cart" className="text-gray-700 hover:text-blue-600">
              Cart
            </Link>
            <Link href="/lists" className="text-gray-700 hover:text-blue-600">
              Lists
            </Link>
            <Link href="/alerts" className="text-gray-700 hover:text-blue-600">
              Alerts
            </Link>
            <Link href="/shipping" className="text-gray-700 hover:text-blue-600">
              Shipping
            </Link>
            <Link href="/rules" className="text-gray-700 hover:text-blue-600">
              Rules
            </Link>
            <Link href="/copilot" className="text-gray-700 hover:text-blue-600">
              Copilot
            </Link>
            <Link href="/profile" className="text-gray-700 hover:text-blue-600">
              Preferences
            </Link>
            <Link href="/audit" className="text-gray-700 hover:text-blue-600">
              Audit
            </Link>
            <Link href="/analytics" className="text-gray-700 hover:text-blue-600">
              Analytics
            </Link>
            <Link href="/admin" className="text-gray-700 hover:text-blue-600">
              Admin
            </Link>
            <Link href="/privacy" className="text-gray-700 hover:text-blue-600">
              Privacy
            </Link>
            <Link href="/account" className="text-gray-700 hover:text-blue-600">
              Account
            </Link>
          </div>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-grow container mx-auto px-4 py-8 focus:outline-none">
        {children}
      </main>
      <footer className="bg-gray-100 text-center py-4 text-sm text-gray-500">
        Universal Cart Optimizer - MVP Demo
      </footer>
    </div>
  );
}
