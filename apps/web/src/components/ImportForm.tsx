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
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Import from any store</h2>
        <div className="inline-flex rounded-lg border border-gray-200 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={mode === 'url' ? 'rounded-md bg-blue-600 px-3 py-1.5 text-white' : 'rounded-md px-3 py-1.5 text-gray-700'}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setMode('search')}
            className={mode === 'search' ? 'rounded-md bg-blue-600 px-3 py-1.5 text-white' : 'rounded-md px-3 py-1.5 text-gray-700'}
          >
            Search
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row" aria-label={mode === 'url' ? 'Import product by URL' : 'Search products'}>
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
              className="min-w-0 flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="min-w-0 flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="rounded-lg border px-3 py-2"
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
          className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          {mode === 'url'
            ? isImporting ? 'Importing...' : 'Add to Cart'
            : isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
      {searchError && (
        <p id="product-search-error" role="alert" className="text-red-500 mt-2 text-sm">
          {searchError}
        </p>
      )}
      {importError && (
        <p id="product-url-error" role="alert" className="text-red-500 mt-2 text-sm">
          {importError}
        </p>
      )}
      {importError === 'Authentication required' && (
        <p className="text-sm mt-2">
          <Link href="/account" className="text-blue-600 hover:underline">Log in or create an account</Link>
        </p>
      )}
      {mode === 'search' && searchResults.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {searchResults.slice(0, 6).map((result) => (
            <article key={`${result.retailerProductId}-${result.rank}`} className="rounded border border-gray-200 p-3">
              <div className="flex gap-3">
                {result.imageUrl ? (
                  <Image
                    src={result.imageUrl}
                    alt={result.productName}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-gray-100" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{result.productName}</h3>
                  <p className="text-sm text-gray-500">
                    {result.sourceRetailer} - ${Number(result.price || 0).toFixed(2)}
                  </p>
                  {result.brand || result.category ? (
                    <p className="truncate text-xs text-gray-500">{[result.brand, result.category].filter(Boolean).join(' - ')}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => importSearchResult(result)}
                disabled={isImporting}
                className="mt-3 w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {isImporting ? 'Adding...' : 'Add result'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
