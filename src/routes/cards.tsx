import { useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { CreditCard, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
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

const cardAccents = [
  "from-teal-500/15 via-card to-surface border-teal-400/25",
  "from-emerald-500/15 via-card to-surface border-emerald-400/25",
  "from-cyan-500/15 via-card to-surface border-cyan-400/25",
  "from-sky-500/15 via-card to-surface border-sky-400/25",
];

function getCardAccent(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return cardAccents[hash % cardAccents.length];
}

function CardsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const cards = useCards();
  const [addOpen, setAddOpen] = useState(false);

  if (pathname !== "/cards") return <Outlet />;

  const sortedCards = sortCardsByPriority(cards.data ?? []);

  return (
    <AppShell>
      <div className="space-y-6">
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

        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
          Personal tracking only. Nexora never needs your real card number, security code, PIN, or
          expiration date.
        </p>

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
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedCards.map((card) => (
              <article
                key={card.id}
                className={`relative isolate min-w-0 overflow-hidden rounded-xl border bg-gradient-to-br p-5 transition-colors hover:border-primary/50 ${getCardAccent(`${card.provider}-${card.id}`)}`}
              >
                <Link
                  to="/cards/$cardId"
                  params={{ cardId: card.id }}
                  aria-label={`Open ${card.name}, priority ${card.priority}`}
                  className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                />
                <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-primary">
                      {card.provider}
                    </p>
                    <h2 className="mt-2 break-words text-lg font-semibold text-foreground">
                      {card.name}
                    </h2>
                    <p className="mt-1 text-sm capitalize text-muted-foreground">
                      {card.card_type} · {card.network}
                    </p>
                  </div>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/30 bg-background/40 text-sm font-semibold text-primary">
                    {card.priority}
                  </div>
                </div>
                <div className="pointer-events-none relative z-10 mt-6 flex flex-wrap items-end justify-between gap-3 border-t border-border/70 pt-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Nexora priority</p>
                    <p className="text-sm font-medium text-foreground">
                      {card.priority}{" "}
                      <span className="font-normal text-muted-foreground">· lower is higher</span>
                    </p>
                  </div>
                  {card.primary_use && (
                    <p className="max-w-[60%] truncate text-right text-xs text-muted-foreground">
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
