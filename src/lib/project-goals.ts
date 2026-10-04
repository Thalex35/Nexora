export type GoalForProject = {
  id: string;
  status: string;
  project_id?: string | null;
};

export type ProjectForGoal = {
  id: string;
  goal_id?: string | null;
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

export function goalProjectId(goal: GoalForProject, projects: ProjectForGoal[]): string | null {
  return goal.project_id ?? projects.find((project) => project.goal_id === goal.id)?.id ?? null;
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
