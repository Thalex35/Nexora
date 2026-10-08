import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateProjectBudgetSummary, formatBudgetAmount } from "./project-budget.ts";

const budgetMigration = readFileSync(
  new URL("../../supabase/migrations/20261010120000_project_budgets.sql", import.meta.url),
  "utf8",
);

test("budget summary totals planned allocations, actual spend, and category variance", () => {
  const summary = calculateProjectBudgetSummary(1000, 800, [
    { category: "Design", planned_amount: 300, actual_amount: 325 },
    { category: "Development", planned_amount: 500, actual_amount: 250.25 },
    { category: "Design", planned_amount: 100, actual_amount: 50 },
  ]);

  assert.equal(summary.planned, 1000);
  assert.equal(summary.allocated, 900);
  assert.equal(summary.actual, 625.25);
  assert.equal(summary.variance, -274.75);
  assert.equal(summary.remaining, 374.75);
  assert.equal(summary.availableFundsRemaining, 174.75);
  assert.equal(summary.progressPercent, 62.525);
  assert.equal(summary.overBudget, false);
  assert.deepEqual(summary.categories, [
    { category: "Design", planned: 400, actual: 375, variance: -25 },
    { category: "Development", planned: 500, actual: 250.25, variance: -249.75 },
  ]);
});

test("over-budget totals retain negative remaining funds and cap progress", () => {
  const summary = calculateProjectBudgetSummary(100, 80, [
    { category: "Equipment", planned_amount: 120, actual_amount: 125.55 },
  ]);

  assert.equal(summary.overBudget, true);
  assert.equal(summary.remaining, -25.55);
  assert.equal(summary.availableFundsRemaining, -45.55);
  assert.equal(summary.progressPercent, 100);
  assert.equal(summary.categories[0]?.variance, 5.55);
});

test("zero budgets and no items avoid division errors", () => {
  assert.deepEqual(calculateProjectBudgetSummary(0, null, []), {
    planned: 0,
    allocated: 0,
    actual: 0,
    variance: 0,
    remaining: 0,
    availableFundsRemaining: null,
    progressPercent: 0,
    overBudget: false,
    categories: [],
  });
  assert.equal(
    calculateProjectBudgetSummary(0, null, [
      { category: "Other", planned_amount: 0, actual_amount: 1 },
    ]).progressPercent,
    100,
  );
});

test("amounts are kept in the chosen currency without conversion", () => {
  const summary = calculateProjectBudgetSummary(100, null, [
    { category: "Travel", planned_amount: 10.005, actual_amount: 20.005 },
  ]);

  assert.equal(summary.allocated, 10.01);
  assert.equal(summary.actual, 20.01);
  assert.equal(summary.remaining, 79.99);
  assert.match(formatBudgetAmount(25, "HTG"), /HTG|G/);
});

test("invalid negative or non-finite amounts are rejected", () => {
  assert.throws(() => calculateProjectBudgetSummary(-1, null, []), RangeError);
  assert.throws(
    () =>
      calculateProjectBudgetSummary(10, null, [
        { category: "Other", planned_amount: 0, actual_amount: Number.NaN },
      ]),
    RangeError,
  );
});

test("budget migration protects ownership, enforces one currency, and cascades budget cleanup", () => {
  assert.match(
    budgetMigration,
    /project_id UUID NOT NULL UNIQUE REFERENCES public\.projects\(id\) ON DELETE CASCADE/,
  );
  assert.match(
    budgetMigration,
    /currency TEXT NOT NULL DEFAULT 'USD' CHECK \(currency IN \('USD', 'EUR', 'HTG'\)\)/,
  );
  assert.match(budgetMigration, /NEW\.user_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(budgetMigration, /WHERE id = NEW\.project_id AND user_id = NEW\.user_id/);
  assert.match(budgetMigration, /FOREIGN KEY \(budget_id, user_id\)[\s\S]*ON DELETE CASCADE/);
  assert.match(budgetMigration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(budgetMigration, /auth\.uid\(\) = user_id/);
  assert.match(budgetMigration, /Delete all budget items before changing the budget currency/);
});
