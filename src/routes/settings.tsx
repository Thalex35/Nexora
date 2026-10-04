import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
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

function SettingsPage() {
  const { user, signOut } = useAuth();
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
