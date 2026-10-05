import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPlanningDate } from "@/lib/planning";
import { unreadNotificationCount, type InAppNotification } from "@/lib/notifications";
import { useInAppNotifications } from "@/lib/notifications-data";

export function NotificationCenter() {
  const { notifications, markRead } = useInAppNotifications();
  const [open, setOpen] = useState(false);
  const items = notifications.data ?? [];
  const unreadCount = unreadNotificationCount(items);
  const visibleItems = [...items]
    .sort(
      (left, right) =>
        Number(Boolean(left.readAt)) - Number(Boolean(right.readAt)) ||
        right.score - left.score ||
        left.date.localeCompare(right.date),
    )
    .slice(0, 25);

  function markOneRead(item: InAppNotification) {
    markRead.mutate([item.sourceKey], {
      onError: () => toast.error("Couldn't mark this reminder as read. Please try again."),
    });
  }

  function markAllRead() {
    markRead.mutate(
      items.filter((item) => !item.readAt).map((item) => item.sourceKey),
      { onError: () => toast.error("Couldn't update reminders. Please try again.") },
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void notifications.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        aria-label="Notifications"
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0"
      >
        <div className="flex shrink-0 flex-col items-start gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Reminders</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Actionable items from your Nexora data.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={markAllRead}
              disabled={markRead.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
        {notifications.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground" role="status">
            Loading reminders…
          </p>
        ) : notifications.isError ? (
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground" role="alert">
              Reminders couldn't be loaded.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void notifications.refetch()}
              disabled={notifications.isFetching}
            >
              {notifications.isFetching ? "Retrying…" : "Try again"}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            You’re all caught up. New actionable deadlines will appear here.
          </p>
        ) : (
          <ul className="min-h-0 max-h-[calc(var(--radix-popover-content-available-height)_-_12rem)] shrink divide-y divide-border overflow-y-auto overscroll-contain md:max-h-[min(70vh,32rem)]">
            {visibleItems.map((item) => (
              <li key={item.sourceKey} className="flex items-start gap-2 p-3">
                <span
                  aria-hidden="true"
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                    item.readAt ? "bg-muted-foreground/40" : "bg-primary"
                  }`}
                />
                <NotificationLink item={item} />
                {!item.readAt && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Mark ${item.title} as read`}
                    title="Mark as read"
                    onClick={() => markOneRead(item)}
                    disabled={markRead.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!notifications.isLoading &&
          !notifications.isError &&
          items.length > visibleItems.length && (
            <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
              Showing the 25 most actionable reminders. Mark reminders as read to review less urgent
              items.
            </p>
          )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationLink({ item }: { item: InAppNotification }) {
  const className =
    "min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const content = (
    <>
      <span className="sr-only">{item.readAt ? "Read reminder. " : "Unread reminder. "}</span>
      <span className="block break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground">
        {item.title}
      </span>
      <span className="mt-0.5 block break-words [overflow-wrap:anywhere] text-xs text-muted-foreground">
        {item.description}
      </span>
      <time dateTime={item.date} className="mt-1 block text-xs text-muted-foreground">
        {formatPlanningDate(item.date, { day: "numeric", month: "short", year: "numeric" })}
      </time>
    </>
  );

  if (item.to === "/goals/$goalId") {
    return (
      <Link to={item.to} params={item.params} className={className}>
        {content}
      </Link>
    );
  }
  if (item.to === "/projects/$projectId") {
    return (
      <Link to={item.to} params={item.params} search={{ goalId: undefined }} className={className}>
        {content}
      </Link>
    );
  }
  if (item.to === "/learning/$learningId") {
    return (
      <Link to={item.to} params={item.params} className={className}>
        {content}
      </Link>
    );
  }
  if (item.to === "/routines") {
    return (
      <Link to="/routines" className={className}>
        {content}
      </Link>
    );
  }
  return (
    <Link to="/tasks" className={className}>
      {content}
    </Link>
  );
}
