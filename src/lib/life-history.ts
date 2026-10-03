import {
  timestampDateISO,
  useAchievements,
  useGoals,
  useLearningItems,
  useLearningSessions,
  useProjects,
  useRoutineCompletions,
  useRoutines,
  useTasks,
  type Achievement,
  type Goal,
  type LearningItem,
  type LearningSession,
  type Project,
  type Routine,
  type RoutineCompletion,
  type Task,
} from "@/lib/nexora-data";

export type HistoryLink =
  | { type: "achievement" }
  | { type: "goal"; id: string }
  | { type: "project"; id: string }
  | { type: "learning"; id: string }
  | { type: "task" }
  | { type: "routine" }
  | { type: "learning-list" };

export type LifeHistoryEvent = {
  id: string;
  date: string;
  title: string;
  detail: string | null;
  source: "Achievement" | "From your records";
  link: HistoryLink;
  dateNote?: string;
};

function completionDateNote() {
  return "Completion dates are not stored for this record; the date shown is its last update.";
}

export function buildLifeHistory(
  achievements: Achievement[],
  goals: Goal[],
  projects: Project[],
  tasks: Task[],
  learningItems: LearningItem[],
  learningSessions: LearningSession[],
  routines: Routine[],
  routineCompletions: RoutineCompletion[],
): LifeHistoryEvent[] {
  const events: LifeHistoryEvent[] = achievements.map((achievement) => ({
    id: `achievement:${achievement.id}`,
    date: achievement.achievement_date,
    title: achievement.title,
    detail: [achievement.category, achievement.description].filter(Boolean).join(" · ") || null,
    source: "Achievement",
    link: { type: "achievement" },
  }));

  for (const goal of goals) {
    if (goal.status !== "completed") continue;
    events.push({
      id: `goal:${goal.id}`,
      date: timestampDateISO(goal.updated_at),
      title: `Completed goal: ${goal.title}`,
      detail: goal.description,
      source: "From your records",
      link: { type: "goal", id: goal.id },
      dateNote: completionDateNote(),
    });
  }

  for (const project of projects) {
    if (project.status !== "completed") continue;
    events.push({
      id: `project:${project.id}`,
      date: timestampDateISO(project.updated_at),
      title: `Completed project: ${project.name}`,
      detail: project.description,
      source: "From your records",
      link: { type: "project", id: project.id },
      dateNote: completionDateNote(),
    });
  }

  for (const task of tasks) {
    if (task.status !== "done") continue;
    events.push({
      id: `task:${task.id}`,
      date: timestampDateISO(task.updated_at),
      title: `Completed task: ${task.title}`,
      detail: task.description,
      source: "From your records",
      link: { type: "task" },
      dateNote: completionDateNote(),
    });
  }

  for (const item of learningItems) {
    if (item.status !== "completed") continue;
    events.push({
      id: `learning:${item.id}`,
      date: timestampDateISO(item.updated_at),
      title: `Completed learning: ${item.title}`,
      detail: item.description,
      source: "From your records",
      link: { type: "learning", id: item.id },
      dateNote: completionDateNote(),
    });
  }

  for (const session of learningSessions) {
    events.push({
      id: `learning-session:${session.id}`,
      date: session.session_date,
      title: `Learning session: ${session.studied}`,
      detail: `${session.duration_minutes} min · ${session.learning_item_title}`,
      source: "From your records",
      link: session.learning_item_id
        ? { type: "learning", id: session.learning_item_id }
        : { type: "learning-list" },
    });
  }

  const routineById = new Map(routines.map((routine) => [routine.id, routine]));
  const completionsByRoutine = new Map<string, string[]>();
  for (const completion of routineCompletions) {
    const dates = completionsByRoutine.get(completion.routine_id) ?? [];
    dates.push(completion.completion_date);
    completionsByRoutine.set(completion.routine_id, dates);
  }

  for (const [routineId, dates] of completionsByRoutine) {
    const routine = routineById.get(routineId);
    if (!routine) continue;
    const uniqueDates = [...new Set(dates)].sort();
    let streak = 0;
    let previous: string | null = null;
    for (const date of uniqueDates) {
      const expectedPrevious = new Date(`${date}T12:00:00`);
      expectedPrevious.setDate(expectedPrevious.getDate() - 1);
      const previousDate = `${expectedPrevious.getFullYear()}-${String(
        expectedPrevious.getMonth() + 1,
      ).padStart(2, "0")}-${String(expectedPrevious.getDate()).padStart(2, "0")}`;
      streak = previous === previousDate ? streak + 1 : 1;
      previous = date;
      if (streak !== 7 && streak !== 30) continue;
      events.push({
        id: `routine-streak:${routineId}:${date}`,
        date,
        title: `${streak}-day routine streak: ${routine.name}`,
        detail: "A meaningful consistency milestone",
        source: "From your records",
        link: { type: "routine" },
      });
    }
  }

  return events.sort(
    (left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id),
  );
}

export function useLifeHistory() {
  const achievements = useAchievements();
  const goals = useGoals();
  const projects = useProjects();
  const tasks = useTasks();
  const learningItems = useLearningItems();
  const learningSessions = useLearningSessions();
  const routines = useRoutines();
  const routineCompletions = useRoutineCompletions();
  const queries = [
    achievements,
    goals,
    projects,
    tasks,
    learningItems,
    learningSessions,
    routines,
    routineCompletions,
  ];

  return {
    events: buildLifeHistory(
      achievements.data ?? [],
      goals.data ?? [],
      projects.data ?? [],
      tasks.data ?? [],
      learningItems.data ?? [],
      learningSessions.data ?? [],
      routines.data ?? [],
      routineCompletions.data ?? [],
    ),
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
