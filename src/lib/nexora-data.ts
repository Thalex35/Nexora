import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { isAuthorizedUserId } from "@/lib/single-user";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type IncomeAllocation = Database["public"]["Tables"]["income_allocations"]["Row"];
export type DailyPlan = Database["public"]["Tables"]["daily_plans"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Routine = Database["public"]["Tables"]["routines"]["Row"];
export type RoutineCompletion = Database["public"]["Tables"]["routine_completions"]["Row"];
export type FutureExpense = Database["public"]["Tables"]["future_expenses"]["Row"];
export type Debt = Database["public"]["Tables"]["debts"]["Row"];
export type LearningItem = Database["public"]["Tables"]["learning_items"]["Row"];
export type LearningSession = Database["public"]["Tables"]["learning_sessions"]["Row"];

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type GoalStatus = Database["public"]["Enums"]["goal_status"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type TransactionType = Database["public"]["Enums"]["transaction_type"];
export type AllocationType = IncomeAllocation["allocation_type"];
export type FutureExpenseStatus = FutureExpense["status"];
export type DebtStatus = Debt["status"];
export type LearningStatus = LearningItem["status"];

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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["goals"] }),
        qc.invalidateQueries({ queryKey: ["projects"] }),
      ]),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<GoalInput> & { id: string }) => {
      await currentUserId();
      return unwrap(await supabase.from("goals").update(values).eq("id", id).select().single());
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["goals"] }),
        qc.invalidateQueries({ queryKey: ["projects"] }),
      ]),
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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["goals"] }),
        qc.invalidateQueries({ queryKey: ["projects"] }),
      ]),
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
  goal_id?: string | null;
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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["projects"] }),
        qc.invalidateQueries({ queryKey: ["goals"] }),
      ]),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<ProjectInput> & { id: string }) => {
      await currentUserId();
      return unwrap(await supabase.from("projects").update(values).eq("id", id).select().single());
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["projects"] }),
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["goals"] }),
      ]),
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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["projects"] }),
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["goals"] }),
      ]),
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

export function useIncome(incomeId: string) {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["transactions", "income", incomeId],
    enabled: authorized && Boolean(incomeId),
    queryFn: async () => {
      await currentUserId();
      const transaction = unwrap(
        await supabase
          .from("transactions")
          .select("*")
          .eq("id", incomeId)
          .eq("type", "income")
          .maybeSingle(),
      ) as Transaction | null;
      return transaction;
    },
  });
}

export function useIncomeExpenses(incomeId: string) {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["transactions", "income-expenses", incomeId],
    enabled: authorized && Boolean(incomeId),
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .eq("income_id", incomeId)
          .eq("type", "expense")
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
  income_id?: string | null;
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

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<TransactionInput> & { id: string }) => {
      await currentUserId();
      return unwrap(
        await supabase.from("transactions").update(values).eq("id", id).select().single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export type FutureExpenseInput = {
  title: string;
  amount: number;
  planned_date: string;
  description?: string | null;
  status?: Exclude<FutureExpenseStatus, "paid">;
};

export function useFutureExpenses() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["future_expenses"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("future_expenses")
          .select("*")
          .eq("user_id", userId)
          .order("planned_date", { ascending: true })
          .order("created_at", { ascending: true }),
      ) as FutureExpense[];
    },
  });
}

export function useCreateFutureExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FutureExpenseInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("future_expenses")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future_expenses"] }),
  });
}

export function useUpdateFutureExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<FutureExpenseInput> & { id: string }) => {
      await currentUserId();
      return unwrap(
        await supabase.from("future_expenses").update(values).eq("id", id).select().single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["future_expenses"] }),
  });
}

export function usePayFutureExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paidDate }: { id: string; paidDate: string }) => {
      await currentUserId();
      return unwrap(
        await supabase.rpc("pay_future_expense", {
          p_future_expense_id: id,
          p_paid_date: paidDate,
        }),
      );
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["future_expenses"] }),
        qc.invalidateQueries({ queryKey: ["transactions"] }),
      ]),
  });
}

export type DebtInput = {
  creditor: string;
  amount: number;
  debt_date: string;
  description?: string | null;
  due_date?: string | null;
  status?: DebtStatus;
  paid_date?: string | null;
};

export function useDebts() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["debts"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("debts")
          .select("*")
          .eq("user_id", userId)
          .order("debt_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ) as Debt[];
    },
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DebtInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("debts")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<DebtInput> & { id: string }) => {
      await currentUserId();
      return unwrap(await supabase.from("debts").update(values).eq("id", id).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
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
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["transactions"] }),
        qc.invalidateQueries({ queryKey: ["income_allocations"] }),
      ]),
  });
}

export type IncomeAllocationInput = {
  income_id: string;
  title: string;
  allocation_type: AllocationType;
  value: number;
  planned_date?: string | null;
  completed?: boolean;
};

export function useIncomeAllocations(incomeId?: string) {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["income_allocations", incomeId ?? "all"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      let query = supabase
        .from("income_allocations")
        .select("*")
        .eq("user_id", userId)
        .order("planned_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (incomeId) query = query.eq("income_id", incomeId);
      return unwrap(await query) as IncomeAllocation[];
    },
  });
}

export function useCreateIncomeAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IncomeAllocationInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("income_allocations")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income_allocations"] }),
  });
}

export function useUpdateIncomeAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<Omit<IncomeAllocationInput, "income_id">> & { id: string }) => {
      await currentUserId();
      return unwrap(
        await supabase.from("income_allocations").update(values).eq("id", id).select().single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income_allocations"] }),
  });
}

export function useDeleteIncomeAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await currentUserId();
      const { error } = await supabase.from("income_allocations").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income_allocations"] }),
  });
}

/* -------------------------------- daily plan -------------------------------- */

export type RoutineInput = {
  name: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export function useRoutines() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["routines"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("routines")
          .select("*")
          .eq("user_id", userId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ) as Routine[];
    },
  });
}

export function useRoutineCompletions(fromDate?: string, throughDate?: string) {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["routine_completions", fromDate ?? "all", throughDate ?? "all"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      let query = supabase
        .from("routine_completions")
        .select("*")
        .eq("user_id", userId)
        .order("completion_date", { ascending: false });
      if (fromDate) query = query.gte("completion_date", fromDate);
      if (throughDate) query = query.lte("completion_date", throughDate);
      return unwrap(await query) as RoutineCompletion[];
    },
  });
}

export function useCreateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RoutineInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("routines")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useUpdateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<RoutineInput> & { id: string }) => {
      await currentUserId();
      return unwrap(await supabase.from("routines").update(values).eq("id", id).select().single());
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await currentUserId();
      const { error } = await supabase.from("routines").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["routines"] }),
        qc.invalidateQueries({ queryKey: ["routine_completions"] }),
      ]),
  });
}

export function useSetRoutineCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routineId,
      completionDate,
      completed,
    }: {
      routineId: string;
      completionDate: string;
      completed: boolean;
    }) => {
      const userId = await currentUserId();
      if (completed) {
        return unwrap(
          await supabase
            .from("routine_completions")
            .upsert(
              {
                routine_id: routineId,
                user_id: userId,
                completion_date: completionDate,
              },
              { onConflict: "routine_id,completion_date" },
            )
            .select()
            .single(),
        );
      }
      const { error } = await supabase
        .from("routine_completions")
        .delete()
        .eq("routine_id", routineId)
        .eq("user_id", userId)
        .eq("completion_date", completionDate);
      if (error) throw new Error(error.message);
      return undefined;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routine_completions"] }),
  });
}

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

export function useDailyPlans(fromDate: string, throughDate: string) {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["daily_plans", fromDate, throughDate],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("daily_plans")
          .select("*")
          .eq("user_id", userId)
          .gte("plan_date", fromDate)
          .lte("plan_date", throughDate)
          .order("plan_date", { ascending: true }),
      ) as DailyPlan[];
    },
  });
}

export function useSaveDailyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      plan_date: string;
      priorities?: string[];
      priority_1?: string | null;
      priority_2?: string | null;
      priority_3?: string | null;
    }) => {
      if (input.plan_date < todayISO()) {
        throw new Error("Past daily priorities are read-only");
      }
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("daily_plans")
          .upsert({ user_id: userId, ...input }, { onConflict: "user_id,plan_date" })
          .select()
          .single(),
      );
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["daily_plan"] }),
        qc.invalidateQueries({ queryKey: ["daily_plans"] }),
      ]),
  });
}

/* --------------------------------- learning --------------------------------- */

export type LearningItemInput = {
  title: string;
  description?: string | null;
  category?: string | null;
  status?: LearningStatus;
  progress?: number;
  target_date?: string | null;
  goal_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
};

export type LearningSessionInput = {
  learning_item_id: string;
  learning_item_title: string;
  session_date: string;
  duration_minutes: number;
  studied: string;
  notes?: string | null;
};

export function useLearningItems() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["learning_items"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("learning_items")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false }),
      ) as LearningItem[];
    },
  });
}

export function useCreateLearningItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LearningItemInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("learning_items")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      ) as LearningItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning_items"] }),
  });
}

export function useUpdateLearningItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<LearningItemInput> & { id: string }) => {
      await currentUserId();
      return unwrap(
        await supabase.from("learning_items").update(values).eq("id", id).select().single(),
      ) as LearningItem;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning_items"] }),
  });
}

export function useDeleteLearningItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await currentUserId();
      const { error } = await supabase.from("learning_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["learning_items"] }),
        qc.invalidateQueries({ queryKey: ["learning_sessions"] }),
      ]),
  });
}

export function useLearningSessions() {
  const { authorized } = useAuth();
  return useQuery({
    queryKey: ["learning_sessions"],
    enabled: authorized,
    queryFn: async () => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("learning_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("session_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ) as LearningSession[];
    },
  });
}

export function useCreateLearningSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LearningSessionInput) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("learning_sessions")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      ) as LearningSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning_sessions"] }),
  });
}
