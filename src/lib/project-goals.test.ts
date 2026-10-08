import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateProjectGoalProgress,
  filterGoalsByProject,
  filterGoalsByProjectState,
  goalProjectId,
  sortGoalsChronologically,
} from "./project-goals.ts";

const goals = [
  { id: "g1", status: "active", project_id: null },
  { id: "g2", status: "completed", project_id: "p1" },
  { id: "g3", status: "completed", project_id: null },
];

const projects = [
  { id: "p1", goal_id: null },
  { id: "p2", goal_id: "g3" },
];
const projectGoalMigration = readFileSync(
  new URL(
    "../../supabase/migrations/20261009000000_project_goal_progress_and_achievements.sql",
    import.meta.url,
  ),
  "utf8",
);

test("project progress is zero, partial, and complete by equal goal weighting", () => {
  assert.deepEqual(calculateProjectGoalProgress([]), {
    total: 0,
    completed: 0,
    progress: 0,
    isComplete: false,
  });
  assert.equal(calculateProjectGoalProgress([goals[0]!]).progress, 0);
  assert.equal(calculateProjectGoalProgress(goals).progress, 67);
  assert.equal(calculateProjectGoalProgress([goals[1]!, goals[2]!]).progress, 100);
  assert.equal(calculateProjectGoalProgress([goals[1]!, goals[2]!]).isComplete, true);
});

test("adding, completing, reopening, and removing goals changes the project aggregate", () => {
  const firstIncomplete = [{ id: "g1", status: "active" }];
  const withSecondIncomplete = [...firstIncomplete, { id: "g2", status: "active" }];
  assert.equal(calculateProjectGoalProgress(firstIncomplete).progress, 0);
  assert.equal(calculateProjectGoalProgress(withSecondIncomplete).isComplete, false);
  assert.equal(
    calculateProjectGoalProgress([
      withSecondIncomplete[0]!,
      { ...withSecondIncomplete[1]!, status: "completed" },
    ]).progress,
    50,
  );
  const bothComplete = withSecondIncomplete.map((goal) => ({ ...goal, status: "completed" }));
  assert.equal(calculateProjectGoalProgress(bothComplete).progress, 100);
  assert.equal(
    calculateProjectGoalProgress([{ ...bothComplete[0]!, status: "active" }, bothComplete[1]!])
      .progress,
    50,
  );
  assert.equal(calculateProjectGoalProgress([]).isComplete, false);
});

test("project association supports the current goal link and legacy project goal link", () => {
  assert.equal(goalProjectId(goals[1]!, projects), "p1");
  assert.equal(goalProjectId(goals[2]!, projects), "p2");
  assert.equal(goalProjectId(goals[0]!, projects), null);
});

test("goal filters keep standalone, linked, completed, and active goals distinct", () => {
  assert.deepEqual(
    filterGoalsByProjectState(goals, projects, "without-project").map((goal) => goal.id),
    ["g1"],
  );
  assert.deepEqual(
    filterGoalsByProjectState(goals, projects, "with-project").map((goal) => goal.id),
    ["g2", "g3"],
  );
  assert.deepEqual(
    filterGoalsByProjectState(goals, projects, "completed").map((goal) => goal.id),
    ["g2", "g3"],
  );
  assert.deepEqual(
    filterGoalsByProjectState(goals, projects, "in-progress").map((goal) => goal.id),
    ["g1"],
  );
});

test("goals are ordered by target date, tie-broken by creation time, and undated goals go last", () => {
  const unorderedGoals = [
    { id: "g-undated", status: "active", target_date: null, created_at: "2026-01-10T00:00:00Z" },
    {
      id: "g-earliest",
      status: "active",
      target_date: "2026-02-10",
      created_at: "2026-01-03T00:00:00Z",
    },
    {
      id: "g-same-date-late",
      status: "active",
      target_date: "2026-03-01",
      created_at: "2026-03-02T00:00:00Z",
    },
    {
      id: "g-same-date-early",
      status: "active",
      target_date: "2026-03-01",
      created_at: "2026-02-28T00:00:00Z",
    },
    {
      id: "g-latest",
      status: "active",
      target_date: "2026-04-15",
      created_at: "2026-04-01T00:00:00Z",
    },
  ];

  assert.deepEqual(
    sortGoalsChronologically(unorderedGoals).map((goal) => goal.id),
    ["g-earliest", "g-same-date-early", "g-same-date-late", "g-latest", "g-undated"],
  );
});

test("project filtering keeps only the selected project while preserving standalone goals with the null option", () => {
  assert.deepEqual(
    filterGoalsByProject(goals, projects, "p1").map((goal) => goal.id),
    ["g2"],
  );
  assert.deepEqual(
    filterGoalsByProject(goals, projects, null).map((goal) => goal.id),
    ["g1"],
  );
  assert.deepEqual(
    filterGoalsByProject(goals, projects, "missing-project").map((goal) => goal.id),
    [],
  );
});

test("database migration enforces goal ownership and recalculates on goal lifecycle changes", () => {
  assert.match(
    projectGoalMigration,
    /ADD COLUMN project_id UUID REFERENCES public\.projects\(id\) ON DELETE SET NULL/,
  );
  assert.match(projectGoalMigration, /NEW\.user_id IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(
    projectGoalMigration,
    /NEW\.project_id[\s\S]*WHERE id = NEW\.project_id AND user_id = NEW\.user_id/,
  );
  assert.match(
    projectGoalMigration,
    /WITH CHECK \(auth\.uid\(\) = user_id AND NOT is_project_completion\)/,
  );
  assert.match(projectGoalMigration, /SECURITY DEFINER[\s\S]*SET search_path = public/);
  assert.match(projectGoalMigration, /project_owner IS DISTINCT FROM auth\.uid\(\)/);
  assert.match(
    projectGoalMigration,
    /REVOKE EXECUTE ON FUNCTION public\.recalculate_project_goal_progress/,
  );
  assert.match(projectGoalMigration, /AFTER INSERT OR UPDATE OF project_id, status OR DELETE/);
  assert.match(projectGoalMigration, /completed_goals \* 100\.0 \/ total_goals/);
  assert.match(projectGoalMigration, /IF total_goals = 0 THEN/);
  assert.match(projectGoalMigration, /WHEN completed_goals = total_goals THEN 'completed'/);
  assert.match(projectGoalMigration, /WHEN status = 'completed' THEN 'active'/);
});

test("database migration makes project completion achievements idempotent and reversible", () => {
  assert.match(
    projectGoalMigration,
    /CREATE UNIQUE INDEX achievements_project_completion_unique_idx[\s\S]*WHERE is_project_completion AND project_id IS NOT NULL/,
  );
  assert.match(projectGoalMigration, /ON CONFLICT \(user_id, project_id\)[\s\S]*DO NOTHING/);
  assert.match(
    projectGoalMigration,
    /DELETE FROM public\.achievements[\s\S]*AND is_project_completion/,
  );
  assert.match(projectGoalMigration, /projects_remove_completion_achievement_on_reopen/);
});
