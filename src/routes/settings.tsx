import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Eye, EyeOff, HardDrive, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  MIN_PASSWORD_LENGTH,
  passwordUpdateErrorMessage,
  validatePasswordConfirmation,
} from "@/lib/password-validation";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Nexora" },
      {
        name: "description",
        content: "Manage your Nexora account and session, and see what is coming to settings next.",
      },
      { property: "og:title", content: "Settings — Nexora" },
      { property: "og:description", content: "Manage your Nexora account and session." },
    ],
  }),
  component: SettingsPage,
});

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || "";
const supabaseProjectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
})();

async function loadSupabaseUsage(userId: string) {
  const results = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("card_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("card_purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("learning_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase.from("routines").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("debts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("future_expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const failedResult = results.find((result) => result.error);
  if (failedResult?.error) {
    throw new Error(`Could not load Supabase data summary: ${failedResult.error.message}`);
  }

  const labels = [
    "Tasks",
    "Projects",
    "Goals",
    "Notes",
    "Transactions",
    "Cards",
    "Subscriptions",
    "Purchases",
    "Learning items",
    "Routines",
    "Debts",
    "Planned expenses",
  ];
  const records = results.map((result, index) => ({
    label: labels[index] ?? "Other",
    count: result.count ?? 0,
  }));

  return {
    records,
    total: records.reduce((sum, record) => sum + record.count, 0),
  };
}

function SettingsPage() {
  const { user, signOut } = useAuth();
  const supabaseUsage = useQuery({
    queryKey: ["settings", "supabase-usage", user?.id],
    enabled: !!user?.id,
    queryFn: () => {
      if (!user) throw new Error("Sign in to view your Supabase data summary.");
      return loadSupabaseUsage(user.id);
    },
  });
  const [signingOut, setSigningOut] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      toast.error("Couldn't log out. Please try again.");
      setSigningOut(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (passwordPending) return;
    const validationError = validatePasswordConfirmation(password, confirmation);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setPasswordPending(true);
    try {
      const {
        data: { user: updatedUser },
        error,
      } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(passwordUpdateErrorMessage(error.status));
        return;
      }
      if (!user || !updatedUser || updatedUser.id !== user.id) {
        toast.error("The updated account couldn't be verified. Sign in again and retry.");
        return;
      }
      setPassword("");
      setConfirmation("");
      setPasswordVisible(false);
      toast.success("Password changed", {
        description: `The password for ${user.email ?? "this account"} was updated.`,
      });
    } catch {
      toast.error(passwordUpdateErrorMessage(undefined));
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Settings" description="Account and session." />

        <section className="nexora-panel max-w-4xl space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary">
                <Database className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">Supabase overview</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Safe project details and counts for your records, using your signed-in access.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void supabaseUsage.refetch()}
              disabled={supabaseUsage.isFetching || !user}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${supabaseUsage.isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-surface/60 p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Connected project
              </p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">
                {supabaseProjectRef ?? "Project reference unavailable"}
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {supabaseUrl || "Supabase URL unavailable"}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-surface/60 p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                Your stored records
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {supabaseUsage.isLoading ? "…" : (supabaseUsage.data?.total ?? "—")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Counts are restricted by your authenticated account and Supabase row-level security.
              </p>
            </div>
          </div>

          {supabaseUsage.isError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {supabaseUsage.error.message}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {(supabaseUsage.data?.records ?? []).map((record) => (
                <div
                  key={record.label}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface/70 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{record.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{record.count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
                Egress remaining
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Not available through user-level access. Supabase only exposes project quota and
                egress metrics through its Management API.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <HardDrive className="h-4 w-4 text-primary" aria-hidden="true" />
                Storage usage
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Project-wide storage totals require admin access. Nexora currently does not upload
                files to Supabase Storage.
              </p>
            </div>
          </div>

          {supabaseProjectRef && (
            <a
              href={`https://supabase.com/dashboard/project/${encodeURIComponent(supabaseProjectRef)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open this project in the Supabase dashboard
            </a>
          )}
        </section>

        <section className="nexora-panel max-w-xl space-y-4 p-6">
          <div>
            <p className="nexora-label">Signed in as</p>
            <p className="mt-1 truncate text-sm text-foreground">{user?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/profile">Edit profile</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              {signingOut ? "Logging out…" : "Log out"}
            </Button>
          </div>
        </section>

        <section className="nexora-panel max-w-xl space-y-4 p-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">Change password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a password with at least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-new-password">New password</Label>
              <div className="relative">
                <Input
                  id="settings-new-password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm-password">Confirm password</Label>
              <Input
                id="settings-confirm-password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              {confirmation && password !== confirmation && (
                <p className="text-xs text-destructive" aria-live="polite">
                  Passwords do not match.
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={
                passwordPending ||
                password.length < MIN_PASSWORD_LENGTH ||
                password !== confirmation
              }
            >
              {passwordPending ? "Changing password…" : "Change password"}
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
