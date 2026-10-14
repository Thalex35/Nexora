import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { NexoraLogo } from "@/components/nexora-logo";
import { NotificationCenter } from "@/components/notification-center";
import { QuickAdd } from "@/components/quick-add";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/nexora-data";

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, authorized, accessDenied, user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const initials = (profile?.full_name ?? user?.email ?? "N")
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    if (!loading && !authorized && !accessDenied) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [loading, authorized, accessDenied, navigate]);

  if (accessDenied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <NexoraLogo className="mb-6" />
        <h1 className="text-lg font-semibold text-foreground">This Nexora instance is private.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with the authorized Nexora account to continue.
        </p>
        <Link to="/auth" className="mt-5 text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (loading || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <NexoraLogo className="animate-pulse" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:gap-3 sm:px-6">
            <SidebarTrigger />
            <div className="min-w-0 flex-1 md:hidden">
              <NexoraLogo size={22} />
            </div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <ThemeToggle />
              <NotificationCenter />
              <QuickAdd />
              <Link
                to="/profile"
                aria-label={`Open profile${profile?.full_name ? ` for ${profile.full_name}` : ""}`}
                className="ml-1 flex items-center gap-2 rounded-full p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials || "N"}
                </span>
                <span className="hidden max-w-36 truncate text-sm font-medium text-foreground sm:inline">
                  {profile?.full_name ?? user?.email ?? "Profile"}
                </span>
              </Link>
            </div>
          </header>
          <main className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-3 py-5 min-[400px]:px-4 sm:px-6 sm:py-7 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
