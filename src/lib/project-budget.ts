export type BudgetItemAmounts = {
  category: string;
  planned_amount: number;
  actual_amount: number;
};

export type BudgetCategorySummary = {
  category: string;
  planned: number;
  actual: number;
  variance: number;
};

export type ProjectBudgetSummary = {
  planned: number;
  allocated: number;
  actual: number;
  variance: number;
  remaining: number;
  availableFundsRemaining: number | null;
  progressPercent: number;
  overBudget: boolean;
  categories: BudgetCategorySummary[];
};

function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("Budget amounts must be finite and non-negative.");
  }
  return Math.round(amount * 100);
}

function fromCents(amount: number): number {
  return amount / 100;
}

export function calculateProjectBudgetSummary(
  plannedBudget: number,
  availableFunds: number | null,
  items: BudgetItemAmounts[],
): ProjectBudgetSummary {
  const plannedCents = toCents(plannedBudget);
  const availableCents = availableFunds === null ? null : toCents(availableFunds);
  const categories = new Map<string, { planned: number; actual: number }>();
  let allocatedCents = 0;
  let actualCents = 0;

  for (const item of items) {
    const itemPlanned = toCents(item.planned_amount);
    const itemActual = toCents(item.actual_amount);
    allocatedCents += itemPlanned;
    actualCents += itemActual;
    const totals = categories.get(item.category) ?? { planned: 0, actual: 0 };
    totals.planned += itemPlanned;
    totals.actual += itemActual;
    categories.set(item.category, totals);
  }

  const remainingCents = plannedCents - actualCents;
  return {
    planned: fromCents(plannedCents),
    allocated: fromCents(allocatedCents),
    actual: fromCents(actualCents),
    variance: fromCents(actualCents - allocatedCents),
    remaining: fromCents(remainingCents),
    availableFundsRemaining:
      availableCents === null ? null : fromCents(availableCents - actualCents),
    progressPercent:
      plannedCents === 0
        ? actualCents > 0
          ? 100
          : 0
        : Math.min(100, (actualCents / plannedCents) * 100),
    overBudget: actualCents > plannedCents,
    categories: [...categories.entries()]
      .map(([category, values]) => ({
        category,
        planned: fromCents(values.planned),
        actual: fromCents(values.actual),
        variance: fromCents(values.actual - values.planned),
      }))
      .sort((left, right) => left.category.localeCompare(right.category)),
  };
}

export function formatBudgetAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
