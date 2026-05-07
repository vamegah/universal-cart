import { getProfile, parseCartRules, saveProfilePreferences } from '@/services/api';
import { useEffect, useState } from 'react';

type RuleSet = {
  version?: number;
  sourceText?: string;
  parsedAt?: string;
  exactMatchesOnly?: boolean;
  allowedCategories?: string[];
  avoidThirdPartySellers?: boolean;
  requireEasyReturns?: boolean;
  maxEtaDays?: number | null;
};

export default function RulesPage() {
  const [text, setText] = useState('Prefer exact matches only, avoid third-party sellers, keep only items with 2-day shipping');
  const [rules, setRules] = useState<RuleSet>({});
  const [shippingPref, setShippingPref] = useState<Record<string, any>>({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile()
      .then((profile) => {
        const pref = profile.preferences?.shippingPref || {};
        setShippingPref(pref);
        setRules(pref.cartRules || {});
      })
      .catch(() => setStatus('Sign in to sync cart rules across devices.'));
  }, []);

  async function parseRules() {
    setError('');
    setStatus('');
    try {
      const parsed = await parseCartRules(text);
      setRules(parsed);
      setStatus('Rules parsed with version metadata. Save them to apply in optimization workflows.');
    } catch (parseError: any) {
      setError(parseError.response?.data?.error || 'Unable to parse rules.');
    }
  }

  async function saveRules() {
    setError('');
    setStatus('');
    try {
      const profile = await getProfile();
      await saveProfilePreferences({
        defaultStore: profile.preferences?.defaultStore || null,
        defaultCardId: profile.preferences?.defaultCardId || null,
        shippingPref: {
          ...shippingPref,
          cartRules: rules,
        },
      });
      setShippingPref((current) => ({ ...current, cartRules: rules }));
      setStatus('Cart rules saved.');
    } catch (saveError: any) {
      setError(saveError.response?.data?.error || 'Unable to save rules.');
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Cart Rules</h1>
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-xl font-semibold">Natural Language Rules</h2>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          className="w-full rounded border px-3 py-2"
        />
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={parseRules} className="rounded bg-blue-600 px-4 py-2 text-white">
            Parse rules
          </button>
          <button type="button" onClick={saveRules} className="rounded border border-blue-300 px-4 py-2 text-blue-700">
            Save rules
          </button>
        </div>
      </section>

      {status && <div className="mt-4 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">{status}</div>}
      {error && <div className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}

      <section className="mt-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-xl font-semibold">Structured Rules</h2>
        {(rules.version || rules.parsedAt) && (
          <div className="mb-4 rounded border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">
            <p className="font-medium">Rules v{rules.version || 1}</p>
            {rules.parsedAt && <p>Parsed {new Date(rules.parsedAt).toLocaleString()}</p>}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(rules.exactMatchesOnly)}
              onChange={(event) => setRules((current) => ({ ...current, exactMatchesOnly: event.target.checked }))}
            />
            Exact matches only
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(rules.avoidThirdPartySellers)}
              onChange={(event) => setRules((current) => ({ ...current, avoidThirdPartySellers: event.target.checked }))}
            />
            Avoid third-party sellers
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(rules.requireEasyReturns)}
              onChange={(event) => setRules((current) => ({ ...current, requireEasyReturns: event.target.checked }))}
            />
            Require easy returns
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Max delivery days</span>
            <input
              type="number"
              min="0"
              value={rules.maxEtaDays ?? ''}
              onChange={(event) => setRules((current) => ({ ...current, maxEtaDays: event.target.value ? Number(event.target.value) : null }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium">Allowed categories</span>
            <input
              value={(rules.allowedCategories || []).join(', ')}
              onChange={(event) => setRules((current) => ({
                ...current,
                allowedCategories: event.target.value.split(',').map((item) => item.trim()).filter(Boolean),
              }))}
              className="w-full rounded border px-3 py-2"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
