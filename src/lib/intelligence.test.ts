import assert from "node:assert/strict";
import test from "node:test";

import { buildFocusRecommendations, parseQuickCapture } from "./intelligence.ts";

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
