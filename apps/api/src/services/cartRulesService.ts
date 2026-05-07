export type CartRuleSet = {
  version?: number;
  sourceText?: string;
  parsedAt?: string;
  exactMatchesOnly?: boolean;
  allowedCategories?: string[];
  avoidThirdPartySellers?: boolean;
  requireEasyReturns?: boolean;
  maxEtaDays?: number | null;
};

export type RuleAwareOption = {
  matchType?: string;
  category?: string;
  isThirdPartySeller?: boolean;
  returnWindowDays?: number | null;
  etaDays?: number | null;
};

function normalize(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseCategoryList(text: string) {
  const categoryMatch = text.match(/only transfer ([a-z0-9\s,&-]+?)(?: items| products|$)/);
  if (!categoryMatch) return [];
  return categoryMatch[1]
    .split(/,| and |&/)
    .map((category) => category.trim())
    .filter(Boolean);
}

function parseEta(text: string) {
  if (text.includes('same day') || text.includes('same-day')) return 0;
  const match = text.match(/(\d+)\s*-?\s*day/);
  return match ? Number(match[1]) : null;
}

export function parseNaturalLanguageCartRules(input: string): CartRuleSet {
  const text = normalize(input);
  const rules: CartRuleSet = {
    version: 1,
    sourceText: input.trim(),
    parsedAt: new Date().toISOString(),
  };

  if (text.includes('exact match') || text.includes('exact matches')) {
    rules.exactMatchesOnly = true;
  }

  const categories = parseCategoryList(text);
  if (categories.length > 0) {
    rules.allowedCategories = categories;
  }

  if (text.includes('avoid third party') || text.includes('avoid third-party') || text.includes('no third party')) {
    rules.avoidThirdPartySellers = true;
  }

  if (text.includes('easy returns') || text.includes('return window') || text.includes('30 day return')) {
    rules.requireEasyReturns = true;
  }

  const etaDays = parseEta(text);
  if (etaDays !== null && Number.isFinite(etaDays)) {
    rules.maxEtaDays = etaDays;
  }

  return rules;
}

export function optionViolations(option: RuleAwareOption, rules?: CartRuleSet) {
  const violations: string[] = [];
  if (!rules) return violations;

  if (rules.exactMatchesOnly && option.matchType && option.matchType !== 'exact') {
    violations.push('requires exact match');
  }

  if (rules.allowedCategories?.length && option.category) {
    const category = option.category.toLowerCase();
    const allowed = rules.allowedCategories.map((value) => value.toLowerCase());
    if (!allowed.some((allowedCategory) => category.includes(allowedCategory) || allowedCategory.includes(category))) {
      violations.push('category not allowed');
    }
  }

  if (rules.avoidThirdPartySellers && option.isThirdPartySeller) {
    violations.push('third-party seller blocked');
  }

  if (rules.requireEasyReturns && (option.returnWindowDays ?? 0) < 30) {
    violations.push('return window below 30 days');
  }

  if (typeof rules.maxEtaDays === 'number' && typeof option.etaDays === 'number' && option.etaDays > rules.maxEtaDays) {
    violations.push(`delivery exceeds ${rules.maxEtaDays} days`);
  }

  return violations;
}

export function optionPassesRules(option: RuleAwareOption, rules?: CartRuleSet) {
  return optionViolations(option, rules).length === 0;
}

export function explainOptionViolations(option: RuleAwareOption, rules?: CartRuleSet) {
  return optionViolations(option, rules).map((violation) => ({
    violation,
    explanation: `Rejected because ${violation}.`,
  }));
}
