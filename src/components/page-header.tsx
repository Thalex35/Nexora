import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 max-w-full">
        <h1 className="break-words text-2xl font-semibold text-foreground sm:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:max-w-full sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
