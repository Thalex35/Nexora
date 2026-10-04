import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { NexoraLogo } from "@/components/nexora-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isAuthorizedUserId } from "@/lib/single-user";
import {
  getRecoveryLinkMessage,
  hasRecoveryCallback,
  MIN_PASSWORD_LENGTH,
  passwordUpdateErrorMessage,
  validateNewPassword,
  validatePasswordConfirmation,
} from "@/lib/password-validation";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Nexora" },
      {
        name: "description",
        content: "Set a new password for your Nexora account and get back to your command center.",
      },
      { property: "og:title", content: "Choose a new password — Nexora" },
      { property: "og:description", content: "Set a new password for your Nexora account." },
    ],
  }),
  component: ResetPasswordPage,
});

type RecoveryStatus = "checking" | "ready" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [linkMessage, setLinkMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const callbackError = getRecoveryLinkMessage(window.location.search, window.location.hash);
    if (callbackError) {
      setLinkMessage(callbackError);
      setStatus("invalid");
      return;
    }

    const recoveryCallback = hasRecoveryCallback(window.location.search, window.location.hash);
    let recoveryResolved = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        recoveryResolved = true;
        if (isAuthorizedUserId(session.user.id)) {
          setStatus("ready");
        } else {
          setLinkMessage("This account isn't authorized for this private Nexora workspace.");
          setStatus("invalid");
        }
      }
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (recoveryResolved) return;
        if (error) {
          setLinkMessage(
            "Couldn't verify this password-reset link. Request a new one to continue.",
          );
          setStatus("invalid");
        } else if (session && recoveryCallback && isAuthorizedUserId(session.user.id)) {
          setStatus("ready");
        } else if (session && recoveryCallback) {
          setLinkMessage("This account isn't authorized for this private Nexora workspace.");
          setStatus("invalid");
        } else {
          setLinkMessage(
            "This password-reset link is invalid or has expired. Request a new one to continue.",
          );
          setStatus("invalid");
        }
      })
      .catch(() => {
        if (!recoveryResolved) {
          setLinkMessage(
            "Couldn't verify this password-reset link. Request a new one to continue.",
          );
          setStatus("invalid");
        }
      });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const validationError = validatePasswordConfirmation(password, confirmation);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        if (error.code === "otp_expired" || error.message.toLocaleLowerCase().includes("expired")) {
          setLinkMessage("This password-reset link has expired. Request a new one to continue.");
          setStatus("invalid");
          return;
        }
        toast.error(passwordUpdateErrorMessage(error.status));
        return;
      }
      setPassword("");
      setConfirmation("");
      toast.success("Password updated");
      void navigate({ to: "/", replace: true });
    } catch {
      toast.error(passwordUpdateErrorMessage(undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <NexoraLogo className="mb-8 justify-center" size={34} />
        {status === "checking" ? (
          <div className="nexora-panel p-6 text-center text-sm text-muted-foreground" role="status">
            Verifying your password-reset link…
          </div>
        ) : status === "invalid" ? (
          <div className="nexora-panel space-y-4 p-6">
            <h1 className="text-lg font-semibold text-foreground">Reset link unavailable</h1>
            <p className="text-sm text-muted-foreground" role="alert">
              {linkMessage}
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">Request another reset link</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="nexora-panel space-y-4 p-6">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Choose a new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Use at least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
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
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
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
              className="w-full"
              disabled={busy || Boolean(validateNewPassword(password)) || password !== confirmation}
            >
              {busy ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
