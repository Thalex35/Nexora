import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CreditCard, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
import { CardVisual } from "@/components/card-visual";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { sortCardsByPriority } from "@/lib/card-usage";
import { useCards } from "@/lib/nexora-data";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Cards — Nexora" },
      {
        name: "description",
        content: "Keep track of the cards you use and the activity associated with each one.",
      },
    ],
  }),
  component: CardsPage,
});

function CardsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const cards = useCards();
  const [addOpen, setAddOpen] = useState(false);

  if (pathname !== "/cards") return <Outlet />;

  const sortedCards = sortCardsByPriority(cards.data ?? []);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-primary/[0.06] via-background to-background p-4 sm:p-6">
          <PageHeader
            title="Cards"
            description="Manage your payment cards and track how you use them."
            actions={
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Add card
              </Button>
            }
          />
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
            <p className="text-xs text-muted-foreground">
              Personal tracking only · Never store card numbers, security codes, PINs, or expiry
              dates.
            </p>
            <p className="shrink-0 text-xs font-medium text-foreground">
              {sortedCards.length} {sortedCards.length === 1 ? "card" : "cards"}
              <span className="ml-2 text-muted-foreground">· priority order</span>
            </p>
          </div>
        </div>

        {cards.isLoading ? (
          <LoadingState />
        ) : cards.isError ? (
          <ErrorState onRetry={() => void cards.refetch()} />
        ) : sortedCards.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-5 w-5" />}
            title="No cards yet"
            description="Add a card to organize its subscriptions, purchases, and notes."
            actionLabel="Add card"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            {sortedCards.map((card) => (
              <article
                key={card.id}
                className="group relative isolate grid min-w-0 gap-4 overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-3 transition-colors hover:border-primary/50 sm:grid-cols-[minmax(10rem,0.9fr)_minmax(0,1fr)] sm:items-center sm:p-4"
              >
                <Link
                  to="/cards/$cardId"
                  params={{ cardId: card.id }}
                  aria-label={`Open ${card.name}, priority ${card.priority}`}
                  className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                />
                <div className="pointer-events-none relative z-10">
                  <CardVisual card={card} compact primary={card.priority === 1} />
                </div>
                <div className="pointer-events-none relative z-10 min-w-0 space-y-3 py-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
                        {card.provider}
                      </p>
                      <h2 className="mt-1 break-words font-semibold text-foreground group-hover:text-primary">
                        {card.name}
                      </h2>
                      <p className="mt-1 text-sm capitalize text-muted-foreground">
                        {card.card_type} · {card.network}
                      </p>
                    </div>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
                      {card.priority}
                    </span>
                  </div>
                  {card.primary_use && (
                    <p className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                      <span className="mr-2 font-medium text-primary">Used for</span>
                      {card.primary_use}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <CardDialog open={addOpen} onOpenChange={setAddOpen} card={null} />
    </AppShell>
  );
}
