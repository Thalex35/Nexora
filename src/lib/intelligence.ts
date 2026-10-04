export type IntelligenceTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
};

export type IntelligenceGoal = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
  progress: number;
};

export type IntelligenceProject = {
  id: string;
  name: string;
  status: string;
  deadline: string | null;
  progress: number;
};

export type FocusRecommendation = {
  id: string;
  title: string;
  reason: string;
  href: string;
  score: number;
};

export function buildFocusRecommendations({
  today,
  priorities,
  tasks,
  goals,
  projects,
}: {
  today: string;
  priorities: string[];
  tasks: IntelligenceTask[];
  goals: IntelligenceGoal[];
  projects: IntelligenceProject[];
}): FocusRecommendation[] {
  const chosenPriorities = new Set(
    priorities.map((priority) => priority.trim().toLocaleLowerCase()),
  );
  const candidates: FocusRecommendation[] = [];

  for (const task of tasks) {
    if (task.status === "done" || chosenPriorities.has(task.title.trim().toLocaleLowerCase()))
      continue;
    const daysUntilDue = task.due_date
      ? Math.round(
          (Date.parse(`${task.due_date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86_400_000,
        )
      : null;
    if (daysUntilDue !== null && daysUntilDue < 0) {
      candidates.push({
        id: `task-${task.id}`,
        title: task.title,
        reason: `Overdue by ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? "day" : "days"}.`,
        href: "/tasks",
        score: 100 + (task.priority === "high" ? 10 : 0),
      });
    } else if (daysUntilDue === 0) {
      candidates.push({
        id: `task-${task.id}`,
        title: task.title,
        reason: "Due today.",
        href: "/tasks",
        score: 80 + (task.priority === "high" ? 10 : 0),
      });
    } else if (daysUntilDue !== null && daysUntilDue <= 3) {
      candidates.push({
        id: `task-${task.id}`,
        title: task.title,
        reason: `Due in ${daysUntilDue} ${daysUntilDue === 1 ? "day" : "days"}.`,
        href: "/tasks",
        score: 60 + (task.priority === "high" ? 10 : 0),
      });
    } else if (task.priority === "high" || task.status === "in_progress") {
      const reason =
        task.priority === "high" && task.status === "in_progress"
          ? "High priority and already in progress."
          : task.priority === "high"
            ? "Marked high priority."
            : "Already in progress.";
      candidates.push({
        id: `task-${task.id}`,
        title: task.title,
        reason,
        href: "/tasks",
        score: task.priority === "high" ? 50 : 40,
      });
    }
  }

  for (const goal of goals) {
    if (goal.status !== "active" || !goal.target_date || goal.target_date > shiftDate(today, 7))
      continue;
    const daysUntilTarget = daysBetween(today, goal.target_date);
    candidates.push({
      id: `goal-${goal.id}`,
      title: goal.title,
      reason:
        daysUntilTarget < 0
          ? `Active goal is past its target date; recorded progress is ${goal.progress}%.`
          : `Target date is ${daysUntilTarget === 0 ? "today" : `in ${daysUntilTarget} days`}; recorded progress is ${goal.progress}%.`,
      href: `/goals/${goal.id}`,
      score: daysUntilTarget < 0 ? 35 : daysUntilTarget === 0 ? 30 : 25 - daysUntilTarget,
    });
  }

  for (const project of projects) {
    if (
      (project.status !== "active" && project.status !== "planning") ||
      !project.deadline ||
      project.deadline > shiftDate(today, 7)
    )
      continue;
    const daysUntilDeadline = daysBetween(today, project.deadline);
    candidates.push({
      id: `project-${project.id}`,
      title: project.name,
      reason:
        daysUntilDeadline < 0
          ? `Active project is past its deadline; recorded progress is ${project.progress}%.`
          : `Deadline is ${daysUntilDeadline === 0 ? "today" : `in ${daysUntilDeadline} days`}; recorded progress is ${project.progress}%.`,
      href: `/projects/${project.id}`,
      score: daysUntilDeadline < 0 ? 34 : daysUntilDeadline === 0 ? 29 : 24 - daysUntilDeadline,
    });
  }

  return candidates.sort((left, right) => right.score - left.score).slice(0, 4);
}

export function parseQuickCapture(input: string, today: string) {
  const text = input.trim();
  if (text.length < 4) return null;

  const amountMatch = text.match(
    /(?:\$\s*([0-9]+(?:\.[0-9]{1,2})?)|(?:spent|expense|paid)\s+\$?\s*([0-9]+(?:\.[0-9]{1,2})?))/i,
  );
  const isExplicitNote = /^(?:note|remember|idea)\s*[:,-]\s*/i.test(text);
  if (amountMatch) {
    const description = text
      .replace(
        /(?:\$\s*[0-9]+(?:\.[0-9]{1,2})?|(?:spent|expense|paid)\s+\$?\s*[0-9]+(?:\.[0-9]{1,2})?)/i,
        "",
      )
      .replace(/^\s*(?:(?:spent|expense|paid)\s+)?(?:on|for|at)\s+/i, "")
      .replace(/^\s*(?:spent|expense|paid)\s+/i, "")
      .replace(/\s+(?:today|tomorrow)\s*$/i, "")
      .replace(/\s+(?:on|for)\s+(?:today|tomorrow)\s*$/i, "")
      .trim();
    if (!description) return null;
    return {
      type: "expense" as const,
      title: "",
      notes: description,
      amount: amountMatch[1] ?? amountMatch[2] ?? "",
      date: /tomorrow/i.test(text) ? shiftDate(today, 1) : /today/i.test(text) ? today : "",
    };
  }

  const withoutDate = text
    .replace(/\s+(?:today|tomorrow)\s*$/i, "")
    .replace(/^(?:task|todo|note|remember|idea)\s*[:,-]\s*/i, "")
    .trim();
  if (!withoutDate) return null;
  const isNote = isExplicitNote;
  return {
    type: isNote ? ("note" as const) : ("task" as const),
    title: withoutDate,
    notes: "",
    amount: "",
    date: /tomorrow/i.test(text) ? shiftDate(today, 1) : /today/i.test(text) ? today : "",
  };
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);
}

function shiftDate(dateISO: string, offset: number) {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
