export interface CouponEvaluation {
  provider: string;
  eligible: boolean;
  confirmed: boolean;
  estimatedSavings: number;
  appliedSavings: number;
  message: string;
}

export interface CouponContext {
  retailerName: string;
  subtotal: number;
  category?: string | null;
}

export interface CouponProvider {
  name: string;
  evaluate(context: CouponContext): Promise<CouponEvaluation>;
}

class PlaceholderCouponProvider implements CouponProvider {
  name = 'placeholder';

  async evaluate(context: CouponContext): Promise<CouponEvaluation> {
    const thresholdEligible = context.subtotal >= 100;
    const categoryEligible = ['beauty', 'fashion', 'electronics'].includes(
      String(context.category || '').toLowerCase()
    );
    const eligible = thresholdEligible || categoryEligible;

    return {
      provider: this.name,
      eligible,
      confirmed: false,
      estimatedSavings: eligible ? Math.round(context.subtotal * 0.05 * 100) / 100 : 0,
      appliedSavings: 0,
      message: eligible
        ? 'Potential coupon eligibility detected, but no discount is applied until a provider confirms it.'
        : 'No coupon eligibility detected by the placeholder provider.',
    };
  }
}

const providers: CouponProvider[] = [new PlaceholderCouponProvider()];

export async function evaluateCoupons(context: CouponContext) {
  const evaluations = await Promise.all(providers.map((provider) => provider.evaluate(context)));
  const estimatedSavings = evaluations.reduce((sum, evaluation) => sum + evaluation.estimatedSavings, 0);
  const appliedSavings = evaluations.reduce((sum, evaluation) => sum + evaluation.appliedSavings, 0);

  return {
    estimatedSavings,
    appliedSavings,
    confirmed: evaluations.some((evaluation) => evaluation.confirmed),
    evaluations,
    note: 'Estimated coupon savings are informational only and are not included in effective totals until confirmed.',
  };
}
