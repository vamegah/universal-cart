import { usePreferences } from '@/hooks/usePreferences';
import { addProfileCard, deleteProfileCard, getBudgetSummary, getProfile, saveProfilePreferences, setBudgetAlert, upsertCardLinkedOffers } from '@/services/api';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const STORES = ['Amazon', 'Walmart', 'Target', "Macy's", 'Best Buy', 'Shopify'];
const SHIPPING_METHODS = [
  { value: 'standard', label: 'Standard Shipping' },
  { value: 'expedited', label: 'Expedited Shipping' },
  { value: 'two-day', label: 'Two-Day Shipping' },
];

type StoredCard = {
  id: string;
  retailerName: string;
  cardLast4: string;
  rewardsRate: number;
};

type LoyaltyMembership = {
  retailerName: string;
  membershipId: string;
  pointsRate: string;
  pointValueCents: string;
  thresholdSpend: string;
  thresholdReward: string;
  promoExpiresAt: string;
};

function emptyLoyaltyMembership(): LoyaltyMembership {
  return {
    retailerName: STORES[0],
    membershipId: '',
    pointsRate: '1',
    pointValueCents: '1',
    thresholdSpend: '',
    thresholdReward: '',
    promoExpiresAt: '',
  };
}

export default function ProfilePage() {
  const {
    preferredMatchStore,
    defaultCheckoutStore,
    defaultShippingMethod,
    maxOrderBudget,
    monthlyFinancingCap,
    preferredInstallmentAmount,
    setPreferredMatchStore,
    setDefaultCheckoutStore,
    setDefaultShippingMethod,
    setMaxOrderBudget,
    setMonthlyFinancingCap,
    setPreferredInstallmentAmount,
  } = usePreferences();
  const [cards, setCards] = useState<StoredCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [newCardStore, setNewCardStore] = useState(STORES[0]);
  const [newCardToken, setNewCardToken] = useState('');
  const [newCardLast4, setNewCardLast4] = useState('');
  const [cardVaultConsent, setCardVaultConsent] = useState(false);
  const [newRewardRate, setNewRewardRate] = useState('5');
  const [loyaltyMemberships, setLoyaltyMemberships] = useState<LoyaltyMembership[]>([]);
  const [newLoyaltyMembership, setNewLoyaltyMembership] = useState<LoyaltyMembership>(emptyLoyaltyMembership());
  const [budgetSummary, setBudgetSummaryState] = useState<any>(null);
  const [existingShippingPref, setExistingShippingPref] = useState<Record<string, any>>({});
  const [minReturnWindowDays, setMinReturnWindowDays] = useState('30');
  const [requireEasyReturns, setRequireEasyReturns] = useState(true);
  const [avoidFinalSale, setAvoidFinalSale] = useState(true);

  type CardOffer = {
    retailerName: string;
    description: string;
    sourceName: string;
    sourceUrl: string;
    termsSummary: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    minSpend: string;
    maxDiscount: string;
    expiresAt: string;
    activated: boolean;
    consentAccepted: boolean;
  };
  const [cardOffers, setCardOffers] = useState<CardOffer[]>([]);
  const [newOffer, setNewOffer] = useState<CardOffer>({
    retailerName: STORES[0], description: '', discountType: 'percent',
    discountValue: 5, minSpend: '', maxDiscount: '', expiresAt: '', activated: true,
    sourceName: '', sourceUrl: '', termsSummary: '', consentAccepted: false,
  });

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId),
    [cards, selectedCardId]
  );

  useEffect(() => {
    let active = true;
    getProfile()
      .then((profile) => {
        if (!active) return;
        setCards(profile.cards || []);
        setSelectedCardId(profile.preferences?.defaultCardId || '');
        setExistingShippingPref(profile.preferences?.shippingPref || {});
        if (profile.preferences?.defaultStore) {
          setPreferredMatchStore(profile.preferences.defaultStore);
        }
        if (profile.preferences?.shippingPref?.method) {
          setDefaultShippingMethod(profile.preferences.shippingPref.method);
        }
        if (profile.preferences?.shippingPref?.budgetControls) {
          const controls = profile.preferences.shippingPref.budgetControls;
          setMaxOrderBudget(controls.maxOrderBudget != null ? String(controls.maxOrderBudget) : '');
          setMonthlyFinancingCap(controls.monthlyFinancingCap != null ? String(controls.monthlyFinancingCap) : '');
          setPreferredInstallmentAmount(controls.preferredInstallmentAmount != null ? String(controls.preferredInstallmentAmount) : '');
        }
        if (profile.preferences?.shippingPref?.returnPreferences) {
          const returnPreferences = profile.preferences.shippingPref.returnPreferences;
          setMinReturnWindowDays(returnPreferences.minReturnWindowDays != null ? String(returnPreferences.minReturnWindowDays) : '30');
          setRequireEasyReturns(returnPreferences.requireEasyReturns !== false);
          setAvoidFinalSale(returnPreferences.avoidFinalSale !== false);
        }
        if (Array.isArray(profile.preferences?.shippingPref?.loyaltyMemberships)) {
          setLoyaltyMemberships(profile.preferences.shippingPref.loyaltyMemberships.map((membership: any) => ({
            retailerName: membership.retailerName || STORES[0],
            membershipId: membership.membershipId || '',
            pointsRate: membership.pointsRate != null ? String(membership.pointsRate) : '1',
            pointValueCents: membership.pointValueCents != null ? String(membership.pointValueCents) : '1',
            thresholdSpend: membership.thresholdSpend != null ? String(membership.thresholdSpend) : '',
            thresholdReward: membership.thresholdReward != null ? String(membership.thresholdReward) : '',
            promoExpiresAt: membership.promoExpiresAt || '',
          })));
        }
        if (Array.isArray(profile.preferences?.shippingPref?.cardLinkedOffers)) {
          setCardOffers(profile.preferences.shippingPref.cardLinkedOffers.map((o: any) => ({
            retailerName: o.retailerName || STORES[0],
            description: o.description || '',
            sourceName: o.sourceName || '',
            sourceUrl: o.sourceUrl || '',
            termsSummary: o.termsSummary || '',
            discountType: o.discountType || 'percent',
            discountValue: o.discountValue ?? 5,
            minSpend: o.minSpend != null ? String(o.minSpend) : '',
            maxDiscount: o.maxDiscount != null ? String(o.maxDiscount) : '',
            expiresAt: o.expiresAt || '',
            activated: o.activated !== false,
            consentAccepted: o.consentAccepted !== false,
          })));
        }
      })
      .catch(() => {
        if (active) setStatus('Sign in to sync preferences across devices.');
      });

    getBudgetSummary()
      .then((summary) => { if (active) setBudgetSummaryState(summary); })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [setDefaultShippingMethod, setMaxOrderBudget, setMonthlyFinancingCap, setPreferredInstallmentAmount, setPreferredMatchStore]);

  async function savePreferences() {
    setError('');
    setStatus('');
    try {
      await saveProfilePreferences({
        defaultStore: preferredMatchStore,
        defaultCardId: selectedCardId || null,
        shippingPref: {
          ...existingShippingPref,
          method: defaultShippingMethod,
          budgetControls: {
            maxOrderBudget: maxOrderBudget ? Number(maxOrderBudget) : null,
            monthlyFinancingCap: monthlyFinancingCap ? Number(monthlyFinancingCap) : null,
            preferredInstallmentAmount: preferredInstallmentAmount ? Number(preferredInstallmentAmount) : null,
          },
          returnPreferences: {
            minReturnWindowDays: minReturnWindowDays ? Number(minReturnWindowDays) : null,
            requireEasyReturns,
            avoidFinalSale,
          },
          loyaltyMemberships: loyaltyMemberships.map((membership) => ({
            retailerName: membership.retailerName,
            membershipId: membership.membershipId || null,
            pointsRate: membership.pointsRate ? Number(membership.pointsRate) : 0,
            pointValueCents: membership.pointValueCents ? Number(membership.pointValueCents) : 0,
            thresholdSpend: membership.thresholdSpend ? Number(membership.thresholdSpend) : null,
            thresholdReward: membership.thresholdReward ? Number(membership.thresholdReward) : null,
            promoExpiresAt: membership.promoExpiresAt || null,
          })),
        },
      });
      setExistingShippingPref((current) => ({
        ...current,
        method: defaultShippingMethod,
        budgetControls: {
          maxOrderBudget: maxOrderBudget ? Number(maxOrderBudget) : null,
          monthlyFinancingCap: monthlyFinancingCap ? Number(monthlyFinancingCap) : null,
          preferredInstallmentAmount: preferredInstallmentAmount ? Number(preferredInstallmentAmount) : null,
        },
        returnPreferences: {
          minReturnWindowDays: minReturnWindowDays ? Number(minReturnWindowDays) : null,
          requireEasyReturns,
          avoidFinalSale,
        },
        loyaltyMemberships,
      }));
      if (selectedCard) {
        setDefaultCheckoutStore(selectedCard.retailerName);
      }
      setStatus('Preferences saved.');
    } catch (saveError: any) {
      setError(saveError.response?.data?.error || 'Unable to save preferences.');
    }
  }

  async function addCard(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const card = await addProfileCard({
        retailerName: newCardStore,
        cardToken: newCardToken,
        cardLast4: newCardLast4,
        rewardsRate: Number(newRewardRate) / 100,
        consentAccepted: cardVaultConsent,
      });
      setCards((current) => [card, ...current]);
      setSelectedCardId(card.id);
      setNewCardToken('');
      setNewCardLast4('');
      setCardVaultConsent(false);
      setStatus('Card reference saved.');
    } catch (saveError: any) {
      setError(saveError.response?.data?.error || 'Unable to save card reference.');
    }
  }

  async function removeCard(cardId: string) {
    setError('');
    setStatus('');
    try {
      await deleteProfileCard(cardId);
      setCards((current) => current.filter((card) => card.id !== cardId));
      if (selectedCardId === cardId) {
        setSelectedCardId('');
      }
      setStatus('Card reference removed.');
    } catch (deleteError: any) {
      setError(deleteError.response?.data?.error || 'Unable to remove card reference.');
    }
  }

  function addLoyaltyMembership() {
    setLoyaltyMemberships((current) => [
      ...current.filter((membership) => membership.retailerName !== newLoyaltyMembership.retailerName),
      newLoyaltyMembership,
    ]);
    setNewLoyaltyMembership(emptyLoyaltyMembership());
    setStatus('Loyalty membership staged. Save preferences to sync it.');
  }

  function removeLoyaltyMembership(retailerName: string) {
    setLoyaltyMemberships((current) => current.filter((membership) => membership.retailerName !== retailerName));
  }

  function addCardOffer() {
    setCardOffers((current) => [
      ...current.filter((o) => !(o.retailerName === newOffer.retailerName && o.description === newOffer.description)),
      newOffer,
    ]);
    setNewOffer({ retailerName: STORES[0], description: '', discountType: 'percent', discountValue: 5, minSpend: '', maxDiscount: '', expiresAt: '', activated: true, sourceName: '', sourceUrl: '', termsSummary: '', consentAccepted: false });
    setStatus('Card offer staged. Save preferences to sync it.');
  }

  function removeCardOffer(index: number) {
    setCardOffers((current) => current.filter((_, i) => i !== index));
  }

  async function saveCardOffers() {
    setError('');
    setStatus('');
    try {
      await upsertCardLinkedOffers(cardOffers.map((o) => ({
        retailerName: o.retailerName,
        description: o.description,
        sourceName: o.sourceName || null,
        sourceUrl: o.sourceUrl || null,
        termsSummary: o.termsSummary || null,
        discountType: o.discountType,
        discountValue: Number(o.discountValue),
        minSpend: o.minSpend ? Number(o.minSpend) : null,
        maxDiscount: o.maxDiscount ? Number(o.maxDiscount) : null,
        expiresAt: o.expiresAt || null,
        activated: o.activated,
        consentAccepted: o.consentAccepted,
      })));
      setStatus('Card-linked offers saved.');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Unable to save card offers.');
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Preferences</h1>
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">Preferred merchant</h2>
          <p className="text-sm text-gray-500 mb-3">
            Choose the default store used for match lookups and optimization.
          </p>
          <select
            value={preferredMatchStore}
            onChange={(e) => setPreferredMatchStore(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          >
            {STORES.map((store) => (
              <option key={store} value={store}>
                {store}
              </option>
            ))}
          </select>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Default payment card</h2>
          <p className="text-sm text-gray-500 mb-3">
            Select the store card you prefer to use by default during checkout.
          </p>
          <select
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            className="w-full border rounded-lg px-4 py-2"
          >
            <option value="">No synced card reference</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.retailerName} ending {card.cardLast4} ({Math.round(card.rewardsRate * 100)}%)
              </option>
            ))}
          </select>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Budget controls</h2>
          {budgetSummary && (
            <div className="mb-4 rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-medium mb-1">This month</p>
              <p className="text-gray-700">
                ${budgetSummary.currentMonthSpend.toFixed(2)} spent across {budgetSummary.currentMonthCheckouts} checkout{budgetSummary.currentMonthCheckouts === 1 ? '' : 's'}
                {budgetSummary.monthlyFinancingCap != null && (
                  <span className="ml-1 text-gray-500">
                    (cap: ${budgetSummary.monthlyFinancingCap.toFixed(2)}{budgetSummary.capUsedPercent != null ? `, ${budgetSummary.capUsedPercent}% used` : ''})
                  </span>
                )}
              </p>
              {budgetSummary.alerts.map((alert: any) => (
                <p key={alert.type} className={`mt-1 font-medium ${alert.type === 'monthly_cap_reached' ? 'text-red-700' : 'text-yellow-700'}`}>
                  {alert.message}
                </p>
              ))}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Max order budget</span>
              <input
                value={maxOrderBudget}
                onChange={(e) => setMaxOrderBudget(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="w-full border rounded-lg px-4 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Monthly financing cap</span>
              <input
                value={monthlyFinancingCap}
                onChange={(e) => setMonthlyFinancingCap(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="w-full border rounded-lg px-4 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Preferred installment</span>
              <input
                value={preferredInstallmentAmount}
                onChange={(e) => setPreferredInstallmentAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="w-full border rounded-lg px-4 py-2"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Card reward references</h2>
          <p className="mb-3 text-sm text-gray-500">
            Store only provider tokens such as tok_ or pm_ references. Raw card numbers and CVV values are rejected.
          </p>
          <form onSubmit={addCard} className="grid gap-3 md:grid-cols-4">
            <select
              value={newCardStore}
              onChange={(e) => setNewCardStore(e.target.value)}
              className="border rounded-lg px-4 py-2"
            >
              {STORES.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
            <input
              value={newCardToken}
              onChange={(e) => setNewCardToken(e.target.value)}
              placeholder="Provider token"
              className="border rounded-lg px-4 py-2"
            />
            <input
              value={newCardLast4}
              onChange={(e) => setNewCardLast4(e.target.value)}
              placeholder="Last 4"
              maxLength={4}
              className="border rounded-lg px-4 py-2"
            />
            <div className="flex gap-2">
              <input
                value={newRewardRate}
                onChange={(e) => setNewRewardRate(e.target.value)}
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="min-w-0 flex-1 border rounded-lg px-4 py-2"
              />
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
                Add
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600 md:col-span-4">
              <input
                type="checkbox"
                checked={cardVaultConsent}
                onChange={(e) => setCardVaultConsent(e.target.checked)}
                className="mt-1"
              />
              <span>
                I confirm this is a tokenized provider reference, not a card number or CVV, and authorize Universal Cart
                to store it for rewards and checkout preference calculations.
              </span>
            </label>
          </form>

          {cards.length > 0 && (
            <div className="mt-4 divide-y rounded border">
              {cards.map((card) => (
                <div key={card.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <span>
                    {card.retailerName} ending {card.cardLast4}, {Math.round(card.rewardsRate * 1000) / 10}% rewards
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    className="rounded border px-3 py-1 text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Preferred shipping method</h2>
          <p className="text-sm text-gray-500 mb-3">
            Save your preferred shipping option for checkout workflows.
          </p>
          <select
            value={defaultShippingMethod}
            onChange={(e) => setDefaultShippingMethod(e.target.value as any)}
            className="w-full border rounded-lg px-4 py-2"
          >
            {SHIPPING_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Return preferences</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Minimum return window</span>
              <input
                value={minReturnWindowDays}
                onChange={(e) => setMinReturnWindowDays(e.target.value)}
                type="number"
                min="0"
                className="w-full border rounded-lg px-4 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={requireEasyReturns}
                onChange={(e) => setRequireEasyReturns(e.target.checked)}
              />
              Require easy returns
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={avoidFinalSale}
                onChange={(e) => setAvoidFinalSale(e.target.checked)}
              />
              Avoid final-sale listings
            </label>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Loyalty memberships</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={newLoyaltyMembership.retailerName}
              onChange={(e) => setNewLoyaltyMembership((current) => ({ ...current, retailerName: e.target.value }))}
              className="border rounded-lg px-4 py-2"
            >
              {STORES.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
            <input
              value={newLoyaltyMembership.membershipId}
              onChange={(e) => setNewLoyaltyMembership((current) => ({ ...current, membershipId: e.target.value }))}
              placeholder="Membership ID"
              className="border rounded-lg px-4 py-2"
            />
            <input
              value={newLoyaltyMembership.pointsRate}
              onChange={(e) => setNewLoyaltyMembership((current) => ({ ...current, pointsRate: e.target.value }))}
              type="number"
              min="0"
              step="0.1"
              placeholder="Points per $"
              className="border rounded-lg px-4 py-2"
            />
            <input
              value={newLoyaltyMembership.pointValueCents}
              onChange={(e) => setNewLoyaltyMembership((current) => ({ ...current, pointValueCents: e.target.value }))}
              type="number"
              min="0"
              step="0.1"
              placeholder="Cents per point"
              className="border rounded-lg px-4 py-2"
            />
            <input
              value={newLoyaltyMembership.thresholdSpend}
              onChange={(e) => setNewLoyaltyMembership((current) => ({ ...current, thresholdSpend: e.target.value }))}
              type="number"
              min="0"
              step="0.01"
              placeholder="Threshold spend"
              className="border rounded-lg px-4 py-2"
            />
            <input
              value={newLoyaltyMembership.thresholdReward}
              onChange={(e) => setNewLoyaltyMembership((current) => ({ ...current, thresholdReward: e.target.value }))}
              type="number"
              min="0"
              step="0.01"
              placeholder="Threshold reward"
              className="border rounded-lg px-4 py-2"
            />
            <input
              value={newLoyaltyMembership.promoExpiresAt}
              onChange={(e) => setNewLoyaltyMembership((current) => ({ ...current, promoExpiresAt: e.target.value }))}
              type="date"
              className="border rounded-lg px-4 py-2"
            />
            <button type="button" onClick={addLoyaltyMembership} className="rounded bg-blue-600 px-4 py-2 text-white">
              Add loyalty
            </button>
          </div>

          {loyaltyMemberships.length > 0 && (
            <div className="mt-4 divide-y rounded border">
              {loyaltyMemberships.map((membership) => (
                <div key={membership.retailerName} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <span>
                    {membership.retailerName}: {membership.pointsRate || 0} points/$, {membership.pointValueCents || 0} cents/point
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLoyaltyMembership(membership.retailerName)}
                    className="rounded border px-3 py-1 text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Card-linked offers</h2>
          <p className="text-sm text-gray-500 mb-3">Import card offers to include them in pricing comparisons and receive expiry reminders.</p>
          <div className="grid gap-3 md:grid-cols-4 mb-3">
            <select value={newOffer.retailerName} onChange={(e) => setNewOffer((o) => ({ ...o, retailerName: e.target.value }))} className="border rounded-lg px-4 py-2">
              {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={newOffer.description} onChange={(e) => setNewOffer((o) => ({ ...o, description: e.target.value }))} placeholder="Offer description" className="border rounded-lg px-4 py-2 md:col-span-2" />
            <select value={newOffer.discountType} onChange={(e) => setNewOffer((o) => ({ ...o, discountType: e.target.value as 'percent' | 'fixed' }))} className="border rounded-lg px-4 py-2">
              <option value="percent">% off</option>
              <option value="fixed">$ off</option>
            </select>
            <input type="number" min="0" value={newOffer.discountValue} onChange={(e) => setNewOffer((o) => ({ ...o, discountValue: Number(e.target.value) }))} placeholder="Value" className="border rounded-lg px-4 py-2" />
            <input type="number" min="0" value={newOffer.minSpend} onChange={(e) => setNewOffer((o) => ({ ...o, minSpend: e.target.value }))} placeholder="Min spend" className="border rounded-lg px-4 py-2" />
            <input type="date" value={newOffer.expiresAt} onChange={(e) => setNewOffer((o) => ({ ...o, expiresAt: e.target.value }))} className="border rounded-lg px-4 py-2" />
            <input value={newOffer.sourceName} onChange={(e) => setNewOffer((o) => ({ ...o, sourceName: e.target.value }))} placeholder="Offer source" className="border rounded-lg px-4 py-2" />
            <input value={newOffer.sourceUrl} onChange={(e) => setNewOffer((o) => ({ ...o, sourceUrl: e.target.value }))} placeholder="Source URL" className="border rounded-lg px-4 py-2" />
            <input value={newOffer.termsSummary} onChange={(e) => setNewOffer((o) => ({ ...o, termsSummary: e.target.value }))} placeholder="Terms summary" className="border rounded-lg px-4 py-2 md:col-span-2" />
            <label className="flex items-center gap-2 text-sm md:col-span-3">
              <input type="checkbox" checked={newOffer.consentAccepted} onChange={(e) => setNewOffer((o) => ({ ...o, consentAccepted: e.target.checked }))} />
              I consent to store this offer source and terms for recommendation calculations.
            </label>
            <button type="button" onClick={addCardOffer} className="rounded bg-blue-600 px-4 py-2 text-white">Add offer</button>
          </div>
          {cardOffers.length > 0 && (
            <div className="divide-y rounded border mb-3">
              {cardOffers.map((offer, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-3 text-sm">
                  <div>
                    <span className="font-medium">{offer.retailerName}</span> — {offer.description}
                    <span className="ml-2 text-gray-500">{offer.discountType === 'percent' ? `${offer.discountValue}% off` : `$${offer.discountValue} off`}</span>
                    {offer.expiresAt && <span className="ml-2 text-xs text-yellow-700">Expires {offer.expiresAt}</span>}
                    {offer.sourceName && <span className="ml-2 text-xs text-gray-500">Source: {offer.sourceName}</span>}
                    {offer.termsSummary && <p className="text-xs text-gray-500">{offer.termsSummary}</p>}
                    <span className={`ml-2 text-xs ${offer.activated ? 'text-green-700' : 'text-gray-400'}`}>{offer.activated ? 'Activated' : 'Inactive'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCardOffers((c) => c.map((o, j) => j === i ? { ...o, activated: !o.activated } : o))} className="rounded border px-2 py-1 text-xs text-gray-600">
                      {offer.activated ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" onClick={() => removeCardOffer(i)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={saveCardOffers} className="rounded border border-blue-300 px-4 py-2 text-sm text-blue-700">Save card offers</button>
        </section>

        <button type="button" onClick={savePreferences} className="rounded bg-blue-600 px-4 py-2 text-white">
          Save preferences
        </button>
        {status && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{status}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      </div>
    </div>
  );
}
