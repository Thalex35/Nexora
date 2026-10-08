import assert from "node:assert/strict";
import test from "node:test";

import type { Project, ProjectBudget, ProjectBudgetItem } from "./nexora-data.ts";
import { createProjectReport } from "./project-pdf.ts";

const project: Project = {
  id: "project-1",
  name: "Nexora",
  description: "A sample project",
  status: "active",
  progress: 25,
  start_date: null,
  deadline: null,
  goal_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  user_id: "user-1",
};

const budget: ProjectBudget = {
  id: "budget-1",
  user_id: "user-1",
  project_id: project.id,
  planned_amount: 1200,
  currency: "USD",
  available_funds: 1000,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const items: ProjectBudgetItem[] = [
  {
    id: "item-1",
    user_id: "user-1",
    budget_id: budget.id,
    title: "Design tools",
    category: "Software",
    planned_amount: 200,
    actual_amount: 75,
    target_date: "2026-03-01",
    notes: "Annual license",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

test("project report includes the optional budget summary and every budget item field", () => {
  const report = createProjectReport(project, [], { budget, items });
  const content = report.output();

  assert.match(content, /Project Budget/);
  assert.match(content, /Planned budget/);
  assert.match(content, /Actual spending/);
  assert.match(content, /Available funds/);
  assert.match(content, /Design tools/);
  assert.match(content, /Software/);
  assert.match(content, /Annual license/);
  assert.match(content, /Target date/);
});

test("project report leaves out the budget section when no budget is provided", () => {
  const report = createProjectReport(project, []);
  assert.doesNotMatch(report.output(), /Project Budget/);
});
