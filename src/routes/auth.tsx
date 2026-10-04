import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { NexoraLogo } from "@/components/nexora-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { normalizeAuthEmail } from "@/lib/password-validation";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Nexora" },
      {
        name: "description",
        content: "Sign in to your private Nexora workspace.",
      },
      { property: "og:title", content: "Sign in — Nexora" },
      {
        property: "og:description",
        content: "Your personal operating system for tasks, goals, projects and finances.",
      },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "reset";

function AuthPage() {
  const { session, loading, authorized, accessDenied } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!loading && session && authorized) {
      void navigate({ to: "/", replace: true });
    }
  }, [loading, session, authorized, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || googleBusy) return;
    setBusy(true);
    try {
      const normalizedEmail = normalizeAuthEmail(email);
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
      } else {
        const redirectTo = new URL("/reset-password", window.location.origin).toString();
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo,
        });
        if (error) throw error;
        toast.success("Reset request submitted", {
          description:
            "If this address belongs to an account, a reset message should arrive. Check spam if it does not; email delivery depends on the Supabase mail configuration.",
        });
        setPassword("");
        setMode("signin");
      }
    } catch (error) {
      toast.error(
        mode === "reset"
          ? "Couldn't request a password reset. Check your connection and try again."
          : error instanceof Error
            ? error.message
            : "Couldn't sign in. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (busy || googleBusy) return;
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) toast.error("Couldn't start Google sign-in. Please try again.");
    } catch {
      toast.error("Couldn't start Google sign-in. Please try again.");
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <NexoraLogo className="justify-center" size={34} />
          <p className="mt-3 text-sm text-muted-foreground">
            Understand your life, organise what matters, take action.
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Private workspace
          </p>
        </div>

        <div className="nexora-panel p-6">
          <h1 className="text-lg font-semibold text-foreground">
            {mode === "reset" ? "Reset your password" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "reset" ? "We'll email you a secure link." : "Use your email to continue."}
          </p>

          {accessDenied && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground"
            >
              This Nexora instance is private.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy || googleBusy}>
              {busy ? "Please wait…" : mode === "reset" ? "Send reset link" : "Sign in"}
            </Button>
          </form>

          {mode !== "reset" && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void handleGoogle()}
                disabled={busy || googleBusy}
              >
                {googleBusy ? "Connecting…" : "Continue with Google"}
              </Button>
            </>
          )}

          <div className="mt-6 space-y-2 text-center text-sm">
            {mode === "signin" && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setMode("reset")}
              >
                Forgot your password?
              </button>
            )}
            {mode === "reset" && (
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode("signin")}
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
