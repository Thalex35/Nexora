export type ReminderTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
};

export type ReminderGoal = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
  progress: number;
};

export type ReminderProject = {
  id: string;
  name: string;
  status: string;
  deadline: string | null;
};

export type ReminderLearningItem = {
  id: string;
  title: string;
  status: string;
  target_date: string | null;
};

export type ReminderRoutine = {
  id: string;
  is_active: boolean;
};

type ReminderDestination =
  | { to: "/tasks"; params?: undefined }
  | { to: "/routines"; params?: undefined }
  | { to: "/goals/$goalId"; params: { goalId: string } }
  | { to: "/projects/$projectId"; params: { projectId: string } }
  | { to: "/learning/$learningId"; params: { learningId: string } };

export type NotificationCandidate = ReminderDestination & {
  sourceKey: string;
  title: string;
  description: string;
  date: string;
  score: number;
};

export type InAppNotification = NotificationCandidate & {
  readAt: string | null;
};

export function buildNotificationCandidates({
  today,
  tasks,
  goals,
  projects,
  learningItems,
  routines = [],
  completedRoutineIds = [],
}: {
  today: string;
  tasks: ReminderTask[];
  goals: ReminderGoal[];
  projects: ReminderProject[];
  learningItems: ReminderLearningItem[];
  routines?: ReminderRoutine[];
  completedRoutineIds?: string[];
}) {
  const candidates: NotificationCandidate[] = [];

  for (const task of tasks) {
    if (task.status === "done" || !task.due_date || task.due_date > addDays(today, 3)) continue;
    const days = daysBetween(today, task.due_date);
    candidates.push({
      sourceKey: `task:${task.id}:${task.due_date}`,
      title: task.title,
      description:
        days < 0
          ? `Overdue by ${-days} ${-days === 1 ? "day" : "days"}.`
          : days === 0
            ? "Due today."
            : `Due in ${days} ${days === 1 ? "day" : "days"}.`,
      date: task.due_date,
      score: (days < 0 ? 100 : days === 0 ? 80 : 60 - days) + (task.priority === "high" ? 10 : 0),
      to: "/tasks",
    });
  }

  for (const goal of goals) {
    if (goal.status !== "active" || !goal.target_date || goal.target_date > addDays(today, 7))
      continue;
    const days = daysBetween(today, goal.target_date);
    candidates.push({
      sourceKey: `goal:${goal.id}:${goal.target_date}`,
      title: goal.title,
      description: deadlineDescription("Goal target", days, goal.progress),
      date: goal.target_date,
      score: days < 0 ? 45 : days === 0 ? 40 : 35 - days,
      to: "/goals/$goalId",
      params: { goalId: goal.id },
    });
  }

  for (const project of projects) {
    if (
      (project.status !== "active" && project.status !== "planning") ||
      !project.deadline ||
      project.deadline > addDays(today, 7)
    )
      continue;
    const days = daysBetween(today, project.deadline);
    candidates.push({
      sourceKey: `project:${project.id}:${project.deadline}`,
      title: project.name,
      description: deadlineDescription("Project deadline", days),
      date: project.deadline,
      score: days < 0 ? 44 : days === 0 ? 39 : 34 - days,
      to: "/projects/$projectId",
      params: { projectId: project.id },
    });
  }

  for (const item of learningItems) {
    if (item.status === "completed" || !item.target_date || item.target_date > addDays(today, 7))
      continue;
    const days = daysBetween(today, item.target_date);
    candidates.push({
      sourceKey: `learning:${item.id}:${item.target_date}`,
      title: item.title,
      description: deadlineDescription("Learning target", days),
      date: item.target_date,
      score: days < 0 ? 30 : days === 0 ? 27 : 22 - days,
      to: "/learning/$learningId",
      params: { learningId: item.id },
    });
  }

  const activeRoutines = routines.filter((routine) => routine.is_active);
  const incompleteRoutineCount = activeRoutines.filter(
    (routine) => !completedRoutineIds.includes(routine.id),
  ).length;
  if (incompleteRoutineCount > 0) {
    candidates.push({
      sourceKey: `routine-checklist:${today}`,
      title: "Routines to complete",
      description: `${incompleteRoutineCount} active ${incompleteRoutineCount === 1 ? "routine isn't" : "routines aren't"} marked complete today.`,
      date: today,
      score: 35,
      to: "/routines",
    });
  }

  const unique = new Map(candidates.map((candidate) => [candidate.sourceKey, candidate]));
  return [...unique.values()].sort(
    (left, right) => right.score - left.score || left.date.localeCompare(right.date),
  );
}

export function applyNotificationReadState(
  candidates: NotificationCandidate[],
  readStates: Array<{ source_key: string; read_at: string }>,
): InAppNotification[] {
  const readAtByKey = new Map(readStates.map((state) => [state.source_key, state.read_at]));
  return candidates.map((candidate) => ({
    ...candidate,
    readAt: readAtByKey.get(candidate.sourceKey) ?? null,
  }));
}

export function unreadNotificationCount(notifications: InAppNotification[]) {
  return notifications.reduce((count, notification) => count + (notification.readAt ? 0 : 1), 0);
}

function deadlineDescription(label: string, days: number, progress?: number) {
  const timing =
    days < 0
      ? `Past target by ${-days} ${-days === 1 ? "day" : "days"}`
      : days === 0
        ? "Due today"
        : `Due in ${days} ${days === 1 ? "day" : "days"}`;
  return `${label}: ${timing}${progress === undefined ? "." : `; recorded progress is ${progress}%.`}`;
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);
}

function addDays(dateISO: string, count: number) {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + count);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
