import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesStore {
  preferredMatchStore: string;
  defaultCheckoutStore: string;
  defaultShippingMethod: 'standard' | 'expedited' | 'two-day';
  maxOrderBudget: string;
  monthlyFinancingCap: string;
  preferredInstallmentAmount: string;
  setPreferredMatchStore: (store: string) => void;
  setDefaultCheckoutStore: (store: string) => void;
  setDefaultShippingMethod: (method: 'standard' | 'expedited' | 'two-day') => void;
  setMaxOrderBudget: (value: string) => void;
  setMonthlyFinancingCap: (value: string) => void;
  setPreferredInstallmentAmount: (value: string) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      preferredMatchStore: 'Amazon',
      defaultCheckoutStore: 'Amazon',
      defaultShippingMethod: 'standard',
      maxOrderBudget: '',
      monthlyFinancingCap: '',
      preferredInstallmentAmount: '',
      setPreferredMatchStore: (store) => set({ preferredMatchStore: store }),
      setDefaultCheckoutStore: (store) => set({ defaultCheckoutStore: store }),
      setDefaultShippingMethod: (method) => set({ defaultShippingMethod: method }),
      setMaxOrderBudget: (value) => set({ maxOrderBudget: value }),
      setMonthlyFinancingCap: (value) => set({ monthlyFinancingCap: value }),
      setPreferredInstallmentAmount: (value) => set({ preferredInstallmentAmount: value }),
    }),
    {
      name: 'universal-cart-preferences',
    }
  )
);
