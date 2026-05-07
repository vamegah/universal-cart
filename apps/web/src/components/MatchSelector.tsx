import React, { useEffect, useState } from 'react';
import { useMatching } from '@/hooks/useMatching';
import { usePreferences } from '@/hooks/usePreferences';

const STORES = ['Amazon', 'Walmart', 'Target', "Macy's"];

interface Props {
  onMatchComplete: () => void;
}

export default function MatchSelector({ onMatchComplete }: Props) {
  const { preferredMatchStore, setPreferredMatchStore } = usePreferences();
  const [preferredStore, setPreferredStore] = useState(preferredMatchStore || '');
  const { matchAllItems, matchingInProgress, matches } = useMatching();

  useEffect(() => {
    setPreferredStore(preferredMatchStore || '');
  }, [preferredMatchStore]);

  const handleMatch = async () => {
    if (!preferredStore) return;
    setPreferredMatchStore(preferredStore);
    await matchAllItems(preferredStore);
    onMatchComplete();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Optimize with your preferred store</h2>
      <p className="text-sm text-gray-500 mb-4">
        Default match store: <strong>{preferredMatchStore || 'None'}</strong>
      </p>
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Select Store</label>
          <select
            value={preferredStore}
            onChange={(e) => setPreferredStore(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          >
            <option value="">-- Choose store --</option>
            {STORES.map((store) => (
              <option key={store} value={store}>
                {store}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleMatch}
          disabled={!preferredStore || matchingInProgress}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {matchingInProgress ? 'Matching...' : 'Find Matches'}
        </button>
      </div>
      {Object.keys(matches).length > 0 && (
        <div className="mt-4 text-sm text-gray-600 space-y-2">
          <p>{Object.values(matches).filter((m: any) => m?.retailerProduct).length} matched item{Object.values(matches).filter((m: any) => m?.retailerProduct).length === 1 ? '' : 's'}.</p>
          <p>{Object.keys(matches).length - Object.values(matches).filter((m: any) => m?.retailerProduct).length} item{Object.keys(matches).length - Object.values(matches).filter((m: any) => m?.retailerProduct).length === 1 ? '' : 's'} not matched yet.</p>
          <div className="space-y-2">
            {Object.entries(matches)
              .filter(([, match]: [string, any]) => match?.assistant)
              .map(([itemId, match]: [string, any]) => (
                <div key={itemId} className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="font-medium text-gray-800">{match.assistant.summary}</p>
                  <p className="text-gray-600">{match.assistant.bestBuyingPath}</p>
                  {match.assistant.approvalPrompt && (
                    <p className="text-amber-700">{match.assistant.approvalPrompt}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
