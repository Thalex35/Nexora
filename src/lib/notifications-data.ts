import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { isAuthorizedUserId } from "@/lib/single-user";
import { applyNotificationReadState, buildNotificationCandidates } from "@/lib/notifications";
import { todayISO } from "@/lib/nexora-data";
import { addCalendarDays } from "@/lib/planning";

async function currentAuthorizedUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user || !isAuthorizedUserId(user.id)) {
    throw new Error("This Nexora instance is private.");
  }
  return user.id;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

export function useInAppNotifications() {
  const { authorized } = useAuth();
  const queryClient = useQueryClient();
  const today = todayISO();

  const notifications = useQuery({
    queryKey: ["in_app_notifications", today],
    enabled: authorized,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const userId = await currentAuthorizedUserId();
      const [
        taskResult,
        upcomingTaskResult,
        goalResult,
        projectResult,
        learningResult,
        routineResult,
        completionResult,
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .eq("user_id", userId)
          .neq("status", "done")
          .not("due_date", "is", null)
          .lt("due_date", today)
          .order("due_date", { ascending: false })
          .limit(10),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .eq("user_id", userId)
          .neq("status", "done")
          .gte("due_date", today)
          .lte("due_date", addCalendarDays(today, 3))
          .order("due_date", { ascending: true })
          .limit(10),
        supabase
          .from("goals")
          .select("id, title, status, target_date, progress")
          .eq("user_id", userId)
          .eq("status", "active")
          .not("target_date", "is", null)
          .lte("target_date", addCalendarDays(today, 7)),
        supabase
          .from("projects")
          .select("id, name, status, deadline")
          .eq("user_id", userId)
          .in("status", ["active", "planning"])
          .not("deadline", "is", null)
          .lte("deadline", addCalendarDays(today, 7)),
        supabase
          .from("learning_items")
          .select("id, title, status, target_date")
          .eq("user_id", userId)
          .neq("status", "completed")
          .not("target_date", "is", null)
          .lte("target_date", addCalendarDays(today, 7)),
        supabase
          .from("routines")
          .select("id, is_active")
          .eq("user_id", userId)
          .eq("is_active", true),
        supabase
          .from("routine_completions")
          .select("routine_id")
          .eq("user_id", userId)
          .eq("completion_date", today),
      ]);
      const candidates = buildNotificationCandidates({
        today,
        tasks: [...unwrap(taskResult), ...unwrap(upcomingTaskResult)],
        goals: unwrap(goalResult),
        projects: unwrap(projectResult),
        learningItems: unwrap(learningResult),
        routines: unwrap(routineResult),
        completedRoutineIds: unwrap(completionResult).map((completion) => completion.routine_id),
      });
      if (candidates.length === 0) return [];

      const sourceKeys = candidates.map((candidate) => candidate.sourceKey);
      const readStates = unwrap(
        await supabase
          .from("notification_read_states")
          .select("source_key, read_at")
          .eq("user_id", userId)
          .in("source_key", sourceKeys),
      );
      return applyNotificationReadState(candidates, readStates);
    },
  });

  const markRead = useMutation({
    mutationFn: async (sourceKeys: string[]) => {
      if (sourceKeys.length === 0) return;
      const userId = await currentAuthorizedUserId();
      const { error } = await supabase.from("notification_read_states").upsert(
        sourceKeys.map((source_key) => ({ user_id: userId, source_key })),
        { onConflict: "user_id,source_key", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["in_app_notifications"] }),
  });

  return { notifications, markRead };
}
