import type { LearningStatus } from "@/lib/nexora-data";

export function learningStateFromProgress(progress: number) {
  const boundedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  return {
    progress: boundedProgress,
    status:
      boundedProgress === 100
        ? ("completed" as const)
        : boundedProgress === 0
          ? ("not_started" as const)
          : ("in_progress" as const),
  };
}

export function learningStateFromStatus(status: LearningStatus, progress: number) {
  if (status === "completed") return { status, progress: 100 };
  if (status === "not_started") return { status, progress: 0 };
  return { status, progress: Math.max(1, Math.min(99, Math.round(progress))) };
}

export function learningStatusLabel(status: LearningStatus) {
  if (status === "not_started") return "Not started";
  if (status === "in_progress") return "In progress";
  return "Completed";
}

export function formatLearningDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString();
}
