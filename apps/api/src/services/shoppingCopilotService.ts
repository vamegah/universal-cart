import { parseNaturalLanguageCartRules, CartRuleSet } from './cartRulesService';
import { ItemCost, optimizeSplitPlanGlobal, ShippingThreshold } from './splitOptimizerService';

export type ShoppingCopilotContext = {
  supportedStores?: string[];
  userCards?: Array<{ retailerName: string; cardLast4?: string }>;
  preferences?: any;
};

export type ShoppingCopilotRequest = {
  command: string;
  items: ItemCost[];
  userStores?: string[];
  shippingThresholds?: ShippingThreshold[];
  context?: ShoppingCopilotContext;
};

function normalize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s'-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleCaseStore(store: string) {
  return store
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join(' ');
}

function findMentionedStores(command: string, stores: string[]) {
  const normalizedCommand = normalize(command);
  return stores.filter((store) => normalizedCommand.includes(normalize(store)));
}

function storesFromCards(command: string, context: ShoppingCopilotContext) {
  const normalizedCommand = normalize(command);
  if (!normalizedCommand.includes('card')) return [];

  return (context.userCards || [])
    .filter((card) => normalizedCommand.includes(normalize(card.retailerName)))
    .map((card) => card.retailerName);
}

export function parseShoppingCopilotCommand(commandInput: unknown, context: ShoppingCopilotContext = {}) {
  const command = String(commandInput || '').trim();
  if (!command) throw new Error('command is required');

  const supportedStores = context.supportedStores || [];
  const mentionedStores = findMentionedStores(command, supportedStores);
  const cardStores = storesFromCards(command, context);
  const targetStores = Array.from(new Set([...cardStores, ...mentionedStores]));
  const normalizedCommand = normalize(command);
  const shouldMove = /\b(move|transfer|switch|use|route)\b/.test(normalizedCommand);
  const rules: CartRuleSet = parseNaturalLanguageCartRules(command);

  return {
    command,
    intent: shouldMove ? 'recommend_transfers' : 'explain_options',
    targetStores,
    usesCardConstraint: cardStores.length > 0,
    requiresConfirmation: true,
    rules,
  };
}

function actionForAssignment(assignment: any) {
  if (!Number.isFinite(assignment.totalCost)) {
    return {
      action: 'manual_review',
      status: 'blocked',
      reason: assignment.reason,
    };
  }

  return {
    action: 'transfer_item',
    status: 'pending_confirmation',
    reason: assignment.reason,
  };
}

export function buildShoppingCopilotRecommendation(request: ShoppingCopilotRequest) {
  const parsed = parseShoppingCopilotCommand(request.command, request.context);
  const fallbackStores = request.userStores || request.context?.supportedStores || [];
  const targetStores = parsed.targetStores.length > 0 ? parsed.targetStores : fallbackStores;
  const normalizedStores = targetStores.length > 0 ? targetStores : ['Manual Review'];

  const plan = optimizeSplitPlanGlobal(
    request.items,
    normalizedStores,
    parsed.rules,
    request.shippingThresholds || [],
    request.context?.preferences
  );

  const recommendations = plan.assignments.map((assignment) => ({
    itemId: assignment.itemId,
    store: assignment.store,
    totalCost: Number.isFinite(assignment.totalCost) ? assignment.totalCost : null,
    ...actionForAssignment(assignment),
    ruleViolations: assignment.ruleViolations || [],
    ruleRejections: assignment.ruleRejections || [],
    citations: {
      breakdown: assignment.breakdown,
      cardLinkedOfferCitations: assignment.cardLinkedOfferCitations || [],
      command: parsed.command,
      targetStores: normalizedStores,
    },
  }));

  const blockedCount = recommendations.filter((recommendation) => recommendation.status === 'blocked').length;
  const pendingCount = recommendations.filter((recommendation) => recommendation.status === 'pending_confirmation').length;

  return {
    command: parsed.command,
    intent: parsed.intent,
    targetStores: normalizedStores.map(titleCaseStore),
    rules: parsed.rules,
    requiresConfirmation: true,
    confirmation: {
      required: true,
      message:
        pendingCount > 0
          ? `Review and confirm ${pendingCount} pending transfer recommendation${pendingCount === 1 ? '' : 's'} before anything changes.`
          : 'No automatic changes are available; review blocked items manually.',
      irreversibleActions: [],
    },
    summary: {
      pendingCount,
      blockedCount,
      totalCost: Number.isFinite(plan.totalCost) ? plan.totalCost : null,
      strategy: plan.strategy,
    },
    recommendations,
    audit: {
      action: 'copilot.recommendations_generated',
      recommendationCount: recommendations.length,
      pendingCount,
      blockedCount,
      targetStores: normalizedStores,
    },
  };
}
