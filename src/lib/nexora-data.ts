import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { isAuthorizedUserId } from "@/lib/single-user";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type GoalStatus = Database["public"]["Enums"]["goal_status"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type TransactionType = Database["public"]["Enums"]["transaction_type"];

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  if (!isAuthorizedUserId(user.id)) throw new Error("This Nexora instance is private.");
  return user.id;
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function dateOffsetISO(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function timestampDateISO(timestamp: string) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/* ---------------------------------- profile --------------------------------- */

export function useProfile() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["profile"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      ) as Profile | null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: { full_name?: string | null; avatar_url?: string | null }) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("profiles")
          .upsert({ id: userId, ...values })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

/* ----------------------------------- tasks ---------------------------------- */

export function useTasks() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["tasks"],
    enabled: authorized,
    queryFn: async () => {
      await currentUserId();
      return unwrap(
        await supabase
          .from("tasks")
          .select("*")
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ) as Task[];
    },
  });
}

export type TaskInput = {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  project_id?: string | null;
};

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("tasks")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<TaskInput> & { id: string }) => {
      await currentUserId();
      return unwrap(await supabase.from("tasks").update(values).eq("id", id).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await currentUserId();
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/* ----------------------------------- goals ---------------------------------- */

export function useGoals() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["goals"],
    enabled: authorized,
    queryFn: async () => {
      await currentUserId();
      return unwrap(
        await supabase.from("goals").select("*").order("created_at", { ascending: false }),
      ) as Goal[];
    },
  });
}

export type GoalInput = {
  title: string;
  description?: string | null;
  status?: GoalStatus;
  target_date?: string | null;
  progress?: number;
};

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GoalInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("goals")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<GoalInput> & { id: string }) => {
      await currentUserId();
      return unwrap(await supabase.from("goals").update(values).eq("id", id).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await currentUserId();
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

/* --------------------------------- projects --------------------------------- */

export function useProjects() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["projects"],
    enabled: authorized,
    queryFn: async () => {
      await currentUserId();
      return unwrap(
        await supabase.from("projects").select("*").order("created_at", { ascending: false }),
      ) as Project[];
    },
  });
}

export type ProjectInput = {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  progress?: number;
  start_date?: string | null;
  deadline?: string | null;
};

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("projects")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<ProjectInput> & { id: string }) => {
      await currentUserId();
      return unwrap(await supabase.from("projects").update(values).eq("id", id).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await currentUserId();
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/* ------------------------------- transactions ------------------------------- */

export function useTransactions() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["transactions"],
    enabled: authorized,
    queryFn: async () => {
      await currentUserId();
      return unwrap(
        await supabase
          .from("transactions")
          .select("*")
          .order("transaction_date", { ascending: false }),
      ) as Transaction[];
    },
  });
}

export type TransactionInput = {
  type: TransactionType;
  amount: number;
  category?: string | null;
  description?: string | null;
  transaction_date?: string;
};

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("transactions")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await currentUserId();
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

/* -------------------------------- daily plan -------------------------------- */

export function useDailyPlan(planDate: string) {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["daily_plan", planDate],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("daily_plans")
          .select("*")
          .eq("user_id", userId)
          .eq("plan_date", planDate)
          .maybeSingle(),
      ) as DailyPlan | null;
    },
  });
}

export function useSaveDailyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      plan_date: string;
      priority_1?: string | null;
      priority_2?: string | null;
      priority_3?: string | null;
    }) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("daily_plans")
          .upsert({ user_id: userId, ...input }, { onConflict: "user_id,plan_date" })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily_plan"] }),
  });
}
