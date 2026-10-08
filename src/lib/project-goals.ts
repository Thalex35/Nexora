export type GoalForProject = {
  id: string;
  status: string;
  project_id?: string | null;
  target_date?: string | null;
  created_at?: string | null;
  title?: string | null;
  description?: string | null;
  progress?: number | null;
};

export type ProjectForGoal = {
  id: string;
  goal_id?: string | null;
  name?: string | null;
};

export function calculateProjectGoalProgress(goals: GoalForProject[]) {
  if (goals.length === 0) return { total: 0, completed: 0, progress: 0, isComplete: false };
  const completed = goals.filter((goal) => goal.status === "completed").length;
  return {
    total: goals.length,
    completed,
    progress: Math.round((completed * 100) / goals.length),
    isComplete: completed === goals.length,
  };
}

export function sortGoalsChronologically<TGoal extends GoalForProject>(goals: TGoal[]) {
  return [...goals].sort((left, right) => {
    const leftPriority = left.target_date ? 0 : 1;
    const rightPriority = right.target_date ? 0 : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    if (left.target_date && right.target_date) {
      const dateComparison = left.target_date.localeCompare(right.target_date);
      if (dateComparison !== 0) {
        return dateComparison;
      }
    }

    const leftCreatedAt = left.created_at ?? "";
    const rightCreatedAt = right.created_at ?? "";
    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt.localeCompare(rightCreatedAt);
    }

    return left.id.localeCompare(right.id);
  });
}

export function goalProjectId(goal: GoalForProject, projects: ProjectForGoal[]): string | null {
  return goal.project_id ?? projects.find((project) => project.goal_id === goal.id)?.id ?? null;
}

export function filterGoalsByProject<TGoal extends GoalForProject, TProject extends ProjectForGoal>(
  goals: TGoal[],
  projects: TProject[],
  projectId: string | null,
) {
  if (!projectId) {
    return goals.filter((goal) => goalProjectId(goal, projects) === null);
  }

  return goals.filter((goal) => goalProjectId(goal, projects) === projectId);
}

export function filterGoalsByProjectState<
  TGoal extends GoalForProject,
  TProject extends ProjectForGoal,
>(
  goals: TGoal[],
  projects: TProject[],
  filter: "all" | "without-project" | "with-project" | "completed" | "in-progress",
) {
  return goals.filter((goal) => {
    const linkedProjectId = goalProjectId(goal, projects);
    switch (filter) {
      case "without-project":
        return linkedProjectId === null;
      case "with-project":
        return linkedProjectId !== null;
      case "completed":
        return goal.status === "completed";
      case "in-progress":
        return goal.status === "active";
      default:
        return true;
    }
  });
}
