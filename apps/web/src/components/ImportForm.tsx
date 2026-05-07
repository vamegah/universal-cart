import React, { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import Link from 'next/link';
import Image from 'next/image';
import { searchProducts } from '@/services/api';

const RETAILER_OPTIONS = ['', 'Amazon', 'Walmart', 'Target', "Macy's", 'BestBuy'];

export default function ImportForm() {
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [retailer, setRetailer] = useState('');
  const [mode, setMode] = useState<'url' | 'search'>('url');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { importProduct, importSearchResult, isImporting, importError } = useCart();
  const productUrlInputId = 'product-url';
  const productSearchInputId = 'product-search';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'url') {
      if (!url.trim()) return;
      await importProduct(url);
      setUrl('');
      return;
    }

    if (query.trim().length < 2) return;
    setIsSearching(true);
    setSearchError('');
    try {
      const data = await searchProducts(query, retailer);
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setSearchError('No products found for that search.');
      }
    } catch (error: any) {
      setSearchError(error.response?.data?.error || 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="uc-panel overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="uc-label">Product Intake</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Import from any store</h2>
          </div>
          <div className="uc-segment">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`uc-segment-button ${mode === 'url' ? 'uc-segment-button-active' : ''}`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`uc-segment-button ${mode === 'search' ? 'uc-segment-button-active' : ''}`}
          >
            Search
          </button>
          </div>
        </div>
      </div>

      <div className="p-5">
      <form onSubmit={handleSubmit} className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]" aria-label={mode === 'url' ? 'Import product by URL' : 'Search products'}>
        {mode === 'url' ? (
          <>
            <label htmlFor={productUrlInputId} className="sr-only">
              Product URL
            </label>
            <input
              id={productUrlInputId}
              type="url"
              placeholder="Paste product URL (Amazon, Walmart, Target...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="uc-input w-full min-w-0 lg:col-span-2"
              aria-describedby={importError ? 'product-url-error' : undefined}
              aria-invalid={Boolean(importError)}
              required
            />
          </>
        ) : (
          <>
            <label htmlFor={productSearchInputId} className="sr-only">
              Product search
            </label>
            <input
              id={productSearchInputId}
              type="search"
              placeholder="Search for headphones, coffee, gifts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="uc-input w-full min-w-0"
              aria-describedby={searchError ? 'product-search-error' : undefined}
              aria-invalid={Boolean(searchError)}
              required
            />
            <label htmlFor="product-search-retailer" className="sr-only">
              Retailer
            </label>
            <select
              id="product-search-retailer"
              value={retailer}
              onChange={(e) => setRetailer(e.target.value)}
              className="uc-input"
            >
              {RETAILER_OPTIONS.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option || 'All stores'}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="submit"
          disabled={isImporting || isSearching}
          className="uc-button-primary min-h-10 w-full whitespace-nowrap lg:w-auto"
        >
          {mode === 'url'
            ? isImporting ? 'Importing...' : 'Add to Cart'
            : isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
      {searchError && (
        <p id="product-search-error" role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {searchError}
        </p>
      )}
      {importError && (
        <p id="product-url-error" role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {importError}
        </p>
      )}
      {importError === 'Authentication required' && (
        <p className="text-sm mt-2">
          <Link href="/account" className="font-semibold text-cyan-700 hover:text-cyan-900">Log in or create an account</Link>
        </p>
      )}
      {mode === 'search' && searchResults.length > 0 && (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {searchResults.slice(0, 6).map((result) => (
            <article key={`${result.retailerProductId}-${result.rank}`} className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex gap-3">
                {result.imageUrl ? (
                  <Image
                    src={result.imageUrl}
                    alt={result.productName}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-md border border-slate-200 bg-white object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-md bg-slate-200" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-950">{result.productName}</h3>
                  <p className="text-sm text-slate-500">
                    {result.sourceRetailer} · ${Number(result.price || 0).toFixed(2)}
                  </p>
                  {result.brand || result.category ? (
                    <p className="truncate text-xs text-slate-500">{[result.brand, result.category].filter(Boolean).join(' · ')}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => importSearchResult(result)}
                disabled={isImporting}
                className="uc-button-secondary mt-3 w-full"
              >
                {isImporting ? 'Adding...' : 'Add result'}
              </button>
            </article>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
