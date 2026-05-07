import { prisma } from '../index';
import { logger } from '../utils/logger';
import { recordAuditEvent } from './auditService';
import { evaluateAutoBuySafety } from './autoBuySafetyService';
import { checkoutWithVirtualCard } from './virtualCardService';

type AutoBuyEvaluationOptions = {
  now?: Date;
};

function selectedMatches(rule: any) {
  return (rule.cart?.items || [])
    .map((item: any) => ({
      item,
      match: (item.matchResults || []).find((match: any) => match.isSelected),
    }))
    .filter((entry: any) => entry.match?.retailerProduct);
}

export function calculateAutoBuyCartTotal(rule: any) {
  return selectedMatches(rule).reduce((total: number, { item, match }: any) => {
    return total + Number(match.retailerProduct.price || 0) * Number(item.quantity || 1);
  }, 0);
}

function dayMatches(daysOfWeek: unknown, now: Date) {
  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return true;
  const currentDay = now.getUTCDay();
  const currentNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return daysOfWeek.some((day) => {
    if (typeof day === 'number') return day === currentDay;
    return String(day).toLowerCase() === currentNames[currentDay];
  });
}

function hourInWindow(startHour: unknown, endHour: unknown, now: Date) {
  const start = Number(startHour);
  const end = Number(endHour);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const hour = now.getUTCHours();
  if (start <= end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function selectedInventoryListing(rule: any, trigger: any) {
  const matches = selectedMatches(rule);
  return matches.find(({ match }: any) => {
    const listing = match.retailerProduct;
    if (trigger.retailerProductId && listing.id !== trigger.retailerProductId) return false;
    if (trigger.retailerName && listing.retailerName !== trigger.retailerName) return false;
    return true;
  });
}

function retailerCartQuantity(rule: any, retailerName: string) {
  return selectedMatches(rule)
    .filter(({ match }: any) => match.retailerProduct.retailerName === retailerName)
    .reduce((sum: number, { item }: any) => sum + Number(item.quantity || 1), 0);
}

export function shouldTriggerAutoBuy(rule: any, now = new Date()) {
  const trigger = rule.trigger as any;
  if (!trigger || typeof trigger !== 'object') {
    return { triggered: false, reason: 'missing_trigger' };
  }

  if (trigger.type === 'total_price_below') {
    const total = calculateAutoBuyCartTotal(rule);
    return {
      triggered: total <= Number(trigger.value),
      reason: 'total_price_below',
      total,
    };
  }

  if (trigger.type === 'inventory_threshold') {
    const selected = selectedInventoryListing(rule, trigger);
    if (!selected) return { triggered: false, reason: 'no_selected_listing' };

    const listing = selected.match.retailerProduct;
    const previousInStock = trigger.previousInStock ?? trigger.lastInStock;
    const observedStock = Number.isFinite(Number(trigger.currentStock))
      ? Number(trigger.currentStock)
      : retailerCartQuantity(rule, listing.retailerName);
    const maxStock = Number(trigger.maxStock);

    return {
      triggered: previousInStock === false && listing.inStock === true && observedStock < maxStock,
      reason: 'inventory_threshold',
      retailerProductId: listing.id,
      retailerName: listing.retailerName,
      observedStock,
    };
  }

  if (trigger.type === 'time_window') {
    const total = calculateAutoBuyCartTotal(rule);
    const maxPrice = Number(trigger.maxPrice);
    return {
      triggered:
        Number.isFinite(maxPrice) &&
        total <= maxPrice &&
        dayMatches(trigger.daysOfWeek, now) &&
        hourInWindow(trigger.startHour, trigger.endHour, now),
      reason: 'time_window',
      total,
    };
  }

  return { triggered: false, reason: 'unsupported_trigger' };
}

async function reactivateRecurringRules(now: Date) {
  const executedRules = await prisma.autoBuyRule.findMany({
    where: { status: 'executed' },
  });

  for (const rule of executedRules) {
    const trigger = rule.trigger as any;
    if (trigger?.type !== 'recurring') continue;

    const cadence = (rule as any).subscriptionCadence || trigger.cadence || {};
    const intervalDays = Number(cadence.intervalDays);
    const executedAt = rule.executedAt ? new Date(rule.executedAt) : null;
    if (!executedAt || !Number.isFinite(intervalDays) || intervalDays <= 0) continue;

    const nextRunAt = new Date(executedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    if (nextRunAt > now) continue;

    await prisma.autoBuyRule.update({
      where: { id: rule.id },
      data: { status: 'active', executedAt: null },
    });
  }
}

export async function evaluateAutoBuyRules(options: AutoBuyEvaluationOptions = {}) {
  const now = options.now || new Date();
  await reactivateRecurringRules(now);

  const rules = await prisma.autoBuyRule.findMany({
    where: { status: 'active' },
    include: {
      cart: {
        include: {
          items: {
            include: {
              matchResults: { include: { retailerProduct: true } },
            },
          },
        },
      },
      user: true,
    },
  });
  for (const rule of rules) {
    try {
      const evaluation = shouldTriggerAutoBuy(rule, now);
      if (evaluation.triggered) {
        const total = 'total' in evaluation && typeof evaluation.total === 'number'
          ? evaluation.total
          : calculateAutoBuyCartTotal(rule);
        const safety = evaluateAutoBuySafety(rule, total, now);
        if (!safety.allowed) {
          await recordAuditEvent({
            userId: rule.user.id,
            action: 'autobuy.execution_blocked',
            entityType: 'auto_buy_rule',
            entityId: rule.id,
            summary: `Auto-buy blocked: ${safety.reason}`,
            metadata: {
              reason: safety.reason,
              message: safety.message,
              total,
            },
          });
          logger.warn(`Auto-buy blocked for rule ${rule.id}`, { reason: safety.reason });
          continue;
        }

        logger.info(`Auto-buy triggered for rule ${rule.id}`, { reason: evaluation.reason });
        await checkoutWithVirtualCard(rule.cart.id, rule.user.id, rule.executionCardId || undefined);
        await prisma.autoBuyRule.update({
          where: { id: rule.id },
          data: { status: 'executed', executedAt: new Date() },
        });
        await recordAuditEvent({
          userId: rule.user.id,
          action: 'autobuy.executed',
          entityType: 'auto_buy_rule',
          entityId: rule.id,
          summary: `Auto-buy executed for rule ${rule.id}`,
          metadata: {
            reason: evaluation.reason,
            total,
            cartId: rule.cart.id,
          },
        });
      }
    } catch (err) {
      logger.error(`Auto-buy rule ${rule.id} failed: ${err}`);
    }
  }
}
