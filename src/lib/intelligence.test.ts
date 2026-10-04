import assert from "node:assert/strict";
import test from "node:test";

import { resolveAchievementReference } from "./achievement-links.ts";
import { buildFocusRecommendations, parseQuickCapture } from "./intelligence.ts";
import {
  applyNotificationReadState,
  buildNotificationCandidates,
  unreadNotificationCount,
} from "./notifications.ts";
import {
  getRecoveryLinkMessage,
  hasRecoveryCallback,
  MIN_PASSWORD_LENGTH,
  normalizeAuthEmail,
  passwordUpdateErrorMessage,
  validateNewPassword,
  validatePasswordConfirmation,
} from "./password-validation.ts";

test("focus ranking prioritizes overdue and upcoming tasks without replacing chosen priorities", () => {
  const recommendations = buildFocusRecommendations({
    today: "2026-10-02",
    priorities: ["Write proposal"],
    tasks: [
      {
        id: "1",
        title: "Write proposal",
        status: "todo",
        priority: "high",
        due_date: "2026-10-02",
      },
      {
        id: "2",
        title: "Renew license",
        status: "todo",
        priority: "medium",
        due_date: "2026-10-01",
      },
      { id: "3", title: "Call dentist", status: "todo", priority: "high", due_date: "2026-10-03" },
      { id: "4", title: "Finished task", status: "done", priority: "high", due_date: "2026-10-01" },
    ],
    goals: [],
    projects: [],
  });
  assert.deepEqual(
    recommendations.map((item) => item.title),
    ["Renew license", "Call dentist"],
  );
  const first = recommendations.at(0);
  assert.ok(first);
  assert.match(first.reason, /Overdue/);
});

test("missing due dates are not invented and active overdue goals retain actual progress", () => {
  const recommendations = buildFocusRecommendations({
    today: "2026-10-02",
    priorities: [],
    tasks: [{ id: "1", title: "Unscheduled", status: "todo", priority: "medium", due_date: null }],
    goals: [
      {
        id: "g1",
        title: "Learn Spanish",
        status: "active",
        target_date: "2026-10-01",
        progress: 35,
      },
      {
        id: "g2",
        title: "Completed",
        status: "completed",
        target_date: "2026-10-01",
        progress: 100,
      },
    ],
    projects: [],
  });
  assert.equal(recommendations.length, 1);
  const first = recommendations.at(0);
  assert.ok(first);
  assert.match(first.reason, /35%/);
});

test("approaching goal and project dates use stored progress and real deadlines", () => {
  const recommendations = buildFocusRecommendations({
    today: "2026-10-02",
    priorities: [],
    tasks: [],
    goals: [
      {
        id: "g1",
        title: "Finish course",
        status: "active",
        target_date: "2026-10-05",
        progress: 60,
      },
    ],
    projects: [
      { id: "p1", name: "Launch site", status: "active", deadline: "2026-10-04", progress: 20 },
    ],
  });
  assert.equal(recommendations.length, 2);
  assert.deepEqual(
    recommendations.map((item) => item.reason),
    [
      "Target date is in 3 days; recorded progress is 60%.",
      "Deadline is in 2 days; recorded progress is 20%.",
    ],
  );
});

test("quick capture prepares only an explicit, reviewable proposal", () => {
  assert.equal(parseQuickCapture("???", "2026-10-02"), null);
  assert.deepEqual(parseQuickCapture("task: Call Sam tomorrow", "2026-10-02"), {
    type: "task",
    title: "Call Sam",
    notes: "",
    amount: "",
    date: "2026-10-03",
  });
  assert.equal(parseQuickCapture("note: Book ideas", "2026-10-02")?.type, "note");
  const expense = parseQuickCapture("spent $12.50 on lunch tomorrow", "2026-10-02");
  assert.equal(expense?.amount, "12.50");
  assert.equal(expense?.notes, "lunch");
  assert.equal(expense?.date, "2026-10-03");
});

test("achievement links retain their destination when linked names cannot be loaded", () => {
  const reference = resolveAchievementReference(
    {
      goal_id: "goal-1",
      project_id: null,
      learning_item_id: null,
      task_id: null,
    },
    { goals: [], projects: [], learningItems: [], tasks: [] },
  );
  assert.deepEqual(reference, { kind: "Goal", id: "goal-1", title: null });
  assert.equal(
    resolveAchievementReference(
      {
        goal_id: null,
        project_id: null,
        learning_item_id: null,
        task_id: null,
      },
      { goals: [], projects: [], learningItems: [], tasks: [] },
    ),
    null,
  );
});

test("notifications include actionable dates once and deduplicate stable reminder keys", () => {
  const candidates = buildNotificationCandidates({
    today: "2026-10-03",
    tasks: [
      { id: "t1", title: "Overdue", status: "todo", priority: "high", due_date: "2026-10-01" },
      { id: "t1", title: "Overdue", status: "todo", priority: "high", due_date: "2026-10-01" },
      { id: "t2", title: "Today", status: "todo", priority: "medium", due_date: "2026-10-03" },
      { id: "t3", title: "Later", status: "todo", priority: "low", due_date: "2026-10-08" },
      { id: "t4", title: "Done", status: "done", priority: "high", due_date: "2026-10-03" },
    ],
    goals: [
      { id: "g1", title: "Goal", status: "active", target_date: "2026-10-10", progress: 40 },
      {
        id: "g2",
        title: "Complete",
        status: "completed",
        target_date: "2026-10-04",
        progress: 100,
      },
    ],
    projects: [
      { id: "p1", name: "Project", status: "planning", deadline: "2026-10-04" },
      { id: "p2", name: "Archived", status: "archived", deadline: "2026-10-04" },
    ],
    learningItems: [
      { id: "l1", title: "Course", status: "in_progress", target_date: "2026-10-05" },
    ],
    routines: [
      { id: "r1", is_active: true },
      { id: "r2", is_active: true },
      { id: "r3", is_active: false },
    ],
    completedRoutineIds: ["r1"],
  });
  assert.deepEqual(
    candidates.map((item) => item.sourceKey),
    [
      "task:t1:2026-10-01",
      "task:t2:2026-10-03",
      "routine-checklist:2026-10-03",
      "project:p1:2026-10-04",
      "goal:g1:2026-10-10",
      "learning:l1:2026-10-05",
    ],
  );
  const withReadState = applyNotificationReadState(candidates, [
    { source_key: "task:t1:2026-10-01", read_at: "2026-10-03T12:00:00Z" },
  ]);
  assert.equal(unreadNotificationCount(withReadState), 5);
});

test("password rules require a minimum length and matching confirmation", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(normalizeAuthEmail("  person@example.com \t"), "person@example.com");
  assert.ok(validateNewPassword("short"));
  assert.equal(validateNewPassword("eight888"), null);
  assert.equal(validatePasswordConfirmation("eight888", "different"), "Passwords do not match.");
  assert.equal(validatePasswordConfirmation("eight888", "eight888"), null);
  assert.match(passwordUpdateErrorMessage(422), /account password requirements/);
  assert.match(passwordUpdateErrorMessage(401), /Sign in again/);
});

test("reset callback detects expired and invalid links without exposing provider messages", () => {
  assert.equal(
    getRecoveryLinkMessage("", "#error=access_denied&error_code=otp_expired"),
    "This password-reset link has expired. Request a new one to continue.",
  );
  assert.match(
    getRecoveryLinkMessage("", "#error=access_denied") ?? "",
    /invalid or has already been used/,
  );
  assert.equal(hasRecoveryCallback("", "#access_token=token&type=recovery"), true);
  assert.equal(hasRecoveryCallback("?code=abc", ""), true);
  assert.equal(hasRecoveryCallback("", ""), false);
});
