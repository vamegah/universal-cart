import { prisma } from '../index';

export interface FinancingOption {
  cardId: string;
  retailerName: string;
  cardLast4: string;
  providerType: string;
  apr: number;
  minPurchase: number;
  creditLimit: number;
  termMonths?: number;
  promoEndsAt?: string;
  monthlyFee?: number;
  downPayment?: number;
  cashPrice: number;
  rewardsRate: number;
  rewardsValue: number;
  rewardsAdjustedTotal: number;
  totalRepayment: number;
  financingCost: number;
  estimatedMonthlyPayment?: number;
  budgetWarnings: string[];
}

function parseTerms(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const terms = value as Record<string, unknown>;
  const apr = Number(terms.apr);
  const minPurchase = Number(terms.minPurchase ?? 0);
  const creditLimit = Number(terms.creditLimit ?? terms.availableCredit ?? 0);
  if (!Number.isFinite(apr) || !Number.isFinite(minPurchase) || !Number.isFinite(creditLimit)) return null;

  return {
    apr,
    minPurchase,
    creditLimit,
    providerType: typeof terms.providerType === 'string' ? terms.providerType : typeof terms.provider === 'string' ? terms.provider : 'store_card',
    termMonths: Number.isFinite(Number(terms.termMonths)) ? Number(terms.termMonths) : undefined,
    monthlyFee: Number.isFinite(Number(terms.monthlyFee)) ? Math.max(0, Number(terms.monthlyFee)) : 0,
    downPaymentPercent: Number.isFinite(Number(terms.downPaymentPercent)) ? Math.max(0, Number(terms.downPaymentPercent)) : 0,
    downPaymentAmount: Number.isFinite(Number(terms.downPaymentAmount)) ? Math.max(0, Number(terms.downPaymentAmount)) : 0,
    promoEndsAt: typeof terms.promoEndsAt === 'string' ? terms.promoEndsAt : undefined,
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function monthlyPayment(principal: number, apr: number, termMonths?: number) {
  if (!termMonths || termMonths <= 0) return undefined;
  if (apr <= 0) return roundMoney(principal / termMonths);

  const monthlyRate = apr / 100 / 12;
  const payment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  return roundMoney(payment);
}

function getBudgetControls(preferences: any) {
  const controls = preferences?.shippingPref?.budgetControls || {};
  return {
    monthlyFinancingCap: Number.isFinite(Number(controls.monthlyFinancingCap)) ? Number(controls.monthlyFinancingCap) : null,
    preferredInstallmentAmount: Number.isFinite(Number(controls.preferredInstallmentAmount)) ? Number(controls.preferredInstallmentAmount) : null,
  };
}

export async function getFinancingOptions(userId: string, totalAmount: number): Promise<FinancingOption[]> {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('totalAmount must be greater than 0');
  }

  const [cards, preferences] = await Promise.all([
    prisma.userCard.findMany({
      where: { userId },
    }),
    prisma.userPreferences.findUnique({ where: { userId } }),
  ]);
  const budgetControls = getBudgetControls(preferences);

  const options: FinancingOption[] = [];

  for (const card of cards) {
    const terms = parseTerms(card.financingTerms);
    if (!terms) continue;
    if (totalAmount < terms.minPurchase || totalAmount > terms.creditLimit) continue;

    const downPayment = roundMoney(Math.max(terms.downPaymentAmount, totalAmount * (terms.downPaymentPercent / 100)));
    const financedPrincipal = Math.max(0, totalAmount - downPayment);
    const estimatedMonthlyPayment = monthlyPayment(financedPrincipal, terms.apr, terms.termMonths);
    const feeTotal = terms.termMonths ? terms.monthlyFee * terms.termMonths : 0;
    const totalRepayment = roundMoney(
      downPayment + (estimatedMonthlyPayment != null && terms.termMonths ? estimatedMonthlyPayment * terms.termMonths : financedPrincipal) + feeTotal
    );
    const financingCost = roundMoney(Math.max(0, totalRepayment - totalAmount));
    const rewardsRate = Number.isFinite(Number(card.rewardsRate)) ? Math.max(0, Number(card.rewardsRate)) : 0;
    const rewardsValue = roundMoney(totalAmount * rewardsRate);
    const budgetWarnings: string[] = [];

    if (budgetControls.monthlyFinancingCap != null && totalAmount > budgetControls.monthlyFinancingCap) {
      budgetWarnings.push(`Total exceeds monthly financing cap of ${budgetControls.monthlyFinancingCap.toFixed(2)}.`);
    }

    if (
      budgetControls.preferredInstallmentAmount != null &&
      estimatedMonthlyPayment != null &&
      estimatedMonthlyPayment > budgetControls.preferredInstallmentAmount
    ) {
      budgetWarnings.push(`Monthly payment exceeds preferred installment amount of ${budgetControls.preferredInstallmentAmount.toFixed(2)}.`);
    }

    const option: FinancingOption = {
      cardId: card.id,
      retailerName: card.retailerName,
      cardLast4: card.cardLast4,
      providerType: terms.providerType,
      apr: terms.apr,
      minPurchase: terms.minPurchase,
      creditLimit: terms.creditLimit,
      monthlyFee: terms.monthlyFee || undefined,
      downPayment: downPayment || undefined,
      cashPrice: roundMoney(totalAmount),
      rewardsRate,
      rewardsValue,
      rewardsAdjustedTotal: roundMoney(totalRepayment - rewardsValue),
      totalRepayment,
      financingCost,
      estimatedMonthlyPayment,
      budgetWarnings,
    };

    if (terms.termMonths !== undefined) {
      option.termMonths = terms.termMonths;
    }
    if (terms.promoEndsAt !== undefined) {
      option.promoEndsAt = terms.promoEndsAt;
    }

    options.push(option);
  }

  return options.sort((left, right) => {
    if (left.rewardsAdjustedTotal !== right.rewardsAdjustedTotal) {
      return left.rewardsAdjustedTotal - right.rewardsAdjustedTotal;
    }
    if (left.financingCost !== right.financingCost) {
      return left.financingCost - right.financingCost;
    }
    return right.creditLimit - left.creditLimit;
  });
}
