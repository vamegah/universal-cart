import { isPaymentProviderReadyForAutonomousCheckout } from './paymentModeService';

export function validateAutoBuySafetyConfig(trigger: any) {
  if (!trigger || typeof trigger !== 'object') {
    return 'trigger must be an object';
  }

  if (trigger.userConsentAccepted !== true) {
    return 'Auto-buy requires explicit userConsentAccepted consent';
  }

  const maxSpendAmount = Number(trigger.maxSpendAmount);
  if (!Number.isFinite(maxSpendAmount) || maxSpendAmount <= 0) {
    return 'Auto-buy requires a positive maxSpendAmount';
  }

  if (trigger.confirmationPolicy !== 'auto_execute') {
    return 'Auto-buy requires confirmationPolicy auto_execute';
  }

  const cancellationWindowMinutes = Number(trigger.cancellationWindowMinutes);
  if (!Number.isFinite(cancellationWindowMinutes) || cancellationWindowMinutes < 0) {
    return 'Auto-buy requires a non-negative cancellationWindowMinutes';
  }

  if (trigger.approvedAt && Number.isNaN(new Date(trigger.approvedAt).getTime())) {
    return 'Auto-buy approvedAt must be a valid date';
  }

  return null;
}

export function evaluateAutoBuySafety(rule: any, total: number, now = new Date()) {
  const trigger = rule.trigger as any;
  const validationError = validateAutoBuySafetyConfig(trigger);
  if (validationError) {
    return { allowed: false, reason: 'invalid_safety_config', message: validationError };
  }

  if (total > Number(trigger.maxSpendAmount)) {
    return { allowed: false, reason: 'max_spend_exceeded', message: 'Cart total exceeds maxSpendAmount' };
  }

  const approvedAt = trigger.approvedAt ? new Date(trigger.approvedAt) : new Date(rule.createdAt || now);
  const cancellationWindowMs = Number(trigger.cancellationWindowMinutes) * 60 * 1000;
  if (approvedAt.getTime() + cancellationWindowMs > now.getTime()) {
    return { allowed: false, reason: 'cancellation_window_open', message: 'Cancellation window is still open' };
  }

  if (!isPaymentProviderReadyForAutonomousCheckout()) {
    return { allowed: false, reason: 'payment_provider_unavailable', message: 'Autonomous checkout payment provider is not configured' };
  }

  return { allowed: true, reason: 'ready' };
}
