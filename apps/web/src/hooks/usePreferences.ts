import { usePreferencesStore } from '@/stores/preferencesStore';

export function usePreferences() {
  const preferredMatchStore = usePreferencesStore((state) => state.preferredMatchStore);
  const defaultCheckoutStore = usePreferencesStore((state) => state.defaultCheckoutStore);
  const defaultShippingMethod = usePreferencesStore((state) => state.defaultShippingMethod);
  const maxOrderBudget = usePreferencesStore((state) => state.maxOrderBudget);
  const monthlyFinancingCap = usePreferencesStore((state) => state.monthlyFinancingCap);
  const preferredInstallmentAmount = usePreferencesStore((state) => state.preferredInstallmentAmount);
  const setPreferredMatchStore = usePreferencesStore((state) => state.setPreferredMatchStore);
  const setDefaultCheckoutStore = usePreferencesStore((state) => state.setDefaultCheckoutStore);
  const setDefaultShippingMethod = usePreferencesStore((state) => state.setDefaultShippingMethod);
  const setMaxOrderBudget = usePreferencesStore((state) => state.setMaxOrderBudget);
  const setMonthlyFinancingCap = usePreferencesStore((state) => state.setMonthlyFinancingCap);
  const setPreferredInstallmentAmount = usePreferencesStore((state) => state.setPreferredInstallmentAmount);

  return {
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
  };
}
