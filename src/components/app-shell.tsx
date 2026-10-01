import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import { NexoraLogo } from "@/components/nexora-logo";
import { QuickAdd } from "@/components/quick-add";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) {
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
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="min-w-0 flex-1 md:hidden">
              <NexoraLogo size={22} />
            </div>
            <div className="ml-auto">
              <QuickAdd />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
