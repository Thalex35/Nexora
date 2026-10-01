import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

/**
 * Shared shape for modules that are intentionally foundations in the MVP.
 * They state honestly what will live here, without faking functionality.
 */
export function FoundationPage({
  title,
  description,
  upcoming,
  icon,
}: {
  title: string;
  description: string;
  upcoming: string[];
  icon: ReactNode;
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={title} description={description} />
        <section className="nexora-panel p-6">
          <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-surface text-primary">
            {icon}
          </div>
          <h2 className="text-base font-semibold text-foreground">Coming in a later sprint</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This module is a foundation today — nothing is stored here yet. It will track:
          </p>
          <ul className="mt-4 space-y-2">
            {upcoming.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
