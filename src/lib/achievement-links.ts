import type { Achievement } from "@/lib/nexora-data";

type AchievementReference = Pick<
  Achievement,
  "goal_id" | "project_id" | "learning_item_id" | "task_id"
>;

type AchievementRecords = {
  goals: Array<{ id: string; title: string }>;
  projects: Array<{ id: string; name: string }>;
  learningItems: Array<{ id: string; title: string }>;
  tasks: Array<{ id: string; title: string }>;
};

export function resolveAchievementReference(
  achievement: AchievementReference,
  records: AchievementRecords,
) {
  if (achievement.goal_id) {
    const record = records.goals.find((item) => item.id === achievement.goal_id);
    return { kind: "Goal" as const, id: achievement.goal_id, title: record?.title ?? null };
  }
  if (achievement.project_id) {
    const record = records.projects.find((item) => item.id === achievement.project_id);
    return { kind: "Project" as const, id: achievement.project_id, title: record?.name ?? null };
  }
  if (achievement.learning_item_id) {
    const record = records.learningItems.find((item) => item.id === achievement.learning_item_id);
    return {
      kind: "Learning" as const,
      id: achievement.learning_item_id,
      title: record?.title ?? null,
    };
  }
  if (achievement.task_id) {
    const record = records.tasks.find((item) => item.id === achievement.task_id);
    return { kind: "Task" as const, id: achievement.task_id, title: record?.title ?? null };
  }
  return null;
}
