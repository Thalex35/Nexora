import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

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

        <section className="nexora-panel max-w-xl p-6">
          <h2 className="text-base font-semibold text-foreground">Coming later</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Notification preferences, currency and locale, and integrations arrive in later sprints.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
