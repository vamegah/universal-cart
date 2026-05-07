import { prisma } from '../index';

export interface BudgetSummary {
  currentMonthSpend: number;
  currentMonthCheckouts: number;
  monthlyFinancingCap: number | null;
  maxOrderBudget: number | null;
  preferredInstallmentAmount: number | null;
  capUsedPercent: number | null;
  alerts: Array<{ type: string; message: string }>;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function budgetControls(preferences: any) {
  const controls = (preferences?.shippingPref as any)?.budgetControls ?? {};
  const parse = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    maxOrderBudget: parse(controls.maxOrderBudget),
    monthlyFinancingCap: parse(controls.monthlyFinancingCap),
    preferredInstallmentAmount: parse(controls.preferredInstallmentAmount),
  };
}

export async function getBudgetSummary(userId: string): Promise<BudgetSummary> {
  const preferences = await prisma.userPreferences.findUnique({ where: { userId } });
  const controls = budgetControls(preferences);

  // Derive monthly spend from checkout redirect audit events this calendar month.
  const checkoutEvents = await prisma.auditEvent.findMany({
    where: {
      userId,
      action: 'checkout.redirect_created',
      createdAt: { gte: startOfCurrentMonth() },
    },
    select: { metadata: true },
  });

  let currentMonthSpend = 0;
  for (const event of checkoutEvents) {
    const meta = event.metadata as Record<string, any> | null;
    const total = Number(meta?.estimatedTotal ?? 0);
    if (Number.isFinite(total)) currentMonthSpend += total;
  }
  currentMonthSpend = Math.round(currentMonthSpend * 100) / 100;

  const capUsedPercent =
    controls.monthlyFinancingCap != null
      ? Math.round((currentMonthSpend / controls.monthlyFinancingCap) * 100)
      : null;

  const alerts: Array<{ type: string; message: string }> = [];

  if (controls.monthlyFinancingCap != null && currentMonthSpend >= controls.monthlyFinancingCap) {
    alerts.push({
      type: 'monthly_cap_reached',
      message: `Monthly financing cap of $${controls.monthlyFinancingCap.toFixed(2)} reached ($${currentMonthSpend.toFixed(2)} spent this month).`,
    });
  } else if (capUsedPercent != null && capUsedPercent >= 80) {
    alerts.push({
      type: 'monthly_cap_warning',
      message: `${capUsedPercent}% of monthly financing cap used ($${currentMonthSpend.toFixed(2)} of $${controls.monthlyFinancingCap!.toFixed(2)}).`,
    });
  }

  return {
    currentMonthSpend,
    currentMonthCheckouts: checkoutEvents.length,
    ...controls,
    capUsedPercent,
    alerts,
  };
}
