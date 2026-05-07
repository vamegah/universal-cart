import { clearAuthToken, deleteAccountData, exportPrivacyData } from '@/services/api';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function PrivacyPage() {
  const router = useRouter();
  const [exportJson, setExportJson] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  async function handleExport() {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      const data = await exportPrivacyData();
      setExportJson(JSON.stringify(data, null, 2));
      setStatus('Data export generated.');
    } catch (exportError: any) {
      setError(exportError.response?.status === 401 ? 'Sign in to export your data.' : 'Unable to export data.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setError('');
    setStatus('');
    setIsBusy(true);
    try {
      await deleteAccountData(confirmation);
      clearAuthToken();
      setStatus('Account data deleted.');
      await router.push('/account');
    } catch (deleteError: any) {
      setError(deleteError.response?.data?.error || 'Unable to delete account data.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Privacy Controls</h1>
      <div className="space-y-6">
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Export Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Generate a JSON export of your account, preferences, cards without tokens, carts, matches, auto-buy rules, and audit events.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={isBusy}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Export my data
          </button>
          {exportJson && (
            <pre className="mt-4 max-h-96 overflow-auto rounded bg-gray-50 p-4 text-xs text-gray-700">
              {exportJson}
            </pre>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Delete Account Data</h2>
          <p className="text-sm text-gray-600 mb-4">
            Delete your account, profile, card references, carts, match selections, auto-buy rules, payment transaction records, and audit events.
          </p>
          <label className="block text-sm font-medium mb-1">Type DELETE to confirm</label>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mb-3 w-full max-w-sm rounded border px-4 py-2"
          />
          <div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isBusy || confirmation !== 'DELETE'}
              className="rounded border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50"
            >
              Delete account data
            </button>
          </div>
        </section>

        {status && <div className="rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">{status}</div>}
        {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      </div>
    </div>
  );
}
