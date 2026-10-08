import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  Link2,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
import { CardVisual } from "@/components/card-visual";
import { CardPurchaseDialog, CardSubscriptionDialog } from "@/components/card-usage-dialogs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeCardUsage } from "@/lib/card-usage";
import {
  useCardPurchases,
  useCardSubscriptions,
  useCards,
  useDeleteCard,
  useDeleteCardPurchase,
  useDeleteCardSubscription,
  type CardPurchase,
  type CardSubscription,
} from "@/lib/nexora-data";

export const Route = createFileRoute("/cards/$cardId")({
  head: () => ({
    meta: [
      { title: "Card details — Nexora" },
      {
        name: "description",
        content: "Review subscriptions and purchases associated with a card.",
      },
    ],
  }),
  component: CardDetailsPage,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString();
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const serviceBrandMarks: Record<string, { slug: string; color: string }> = {
  adobe: { slug: "adobe", color: "ff0000" },
  amazon: { slug: "amazon", color: "ff9900" },
  apple: { slug: "apple", color: "ffffff" },
  canva: { slug: "canva", color: "00c4cc" },
  disney: { slug: "disneyplus", color: "113ccf" },
  "disney+": { slug: "disneyplus", color: "113ccf" },
  google: { slug: "google", color: "4285f4" },
  hulu: { slug: "hulu", color: "1ce783" },
  microsoft: { slug: "microsoft", color: "f25022" },
  netflix: { slug: "netflix", color: "e50914" },
  spotify: { slug: "spotify", color: "1ed760" },
  steam: { slug: "steam", color: "66c0f4" },
  uber: { slug: "uber", color: "ffffff" },
  upwork: { slug: "upwork", color: "6fda44" },
  youtube: { slug: "youtube", color: "ff0000" },
  zoom: { slug: "zoom", color: "2d8cff" },
};

function ServiceLogo({ name }: { name: string }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const brandName = name.trim().toLowerCase();
  const brand = Object.entries(serviceBrandMarks).find(
    ([knownName]) => brandName === knownName || brandName.startsWith(`${knownName} `),
  )?.[1];
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";

  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/80 bg-surface/80"
    >
      {brand && !logoFailed ? (
        <img
          src={`https://cdn.simpleicons.org/${brand.slug}/${brand.color}`}
          alt=""
          loading="lazy"
          className="h-5 w-5 object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="text-[10px] font-bold tracking-wide text-muted-foreground">
          {initials}
        </span>
      )}
    </span>
  );
}

function CardDetailsPage() {
  const { cardId } = Route.useParams();
  const cards = useCards();
  const subscriptions = useCardSubscriptions(cardId);
  const purchases = useCardPurchases(cardId);
  const deleteCard = useDeleteCard();
  const deleteSubscription = useDeleteCardSubscription();
  const deletePurchase = useDeleteCardPurchase();
  const [editCardOpen, setEditCardOpen] = useState(false);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<CardSubscription | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CardPurchase | null>(null);
  const [pendingSubscriptionDelete, setPendingSubscriptionDelete] =
    useState<CardSubscription | null>(null);
  const [pendingPurchaseDelete, setPendingPurchaseDelete] = useState<CardPurchase | null>(null);
  const [confirmCardDelete, setConfirmCardDelete] = useState(false);
  const card = (cards.data ?? []).find((item) => item.id === cardId);
  const loading = cards.isLoading || subscriptions.isLoading || purchases.isLoading;
  const usageSummary = summarizeCardUsage(subscriptions.data ?? [], purchases.data ?? []);
  const recentActivity = [
    ...(subscriptions.data ?? []).map((subscription) => ({
      id: subscription.id,
      title: subscription.service_name,
      type: subscription.is_free_trial ? "Free trial" : "Subscription",
      date: subscription.start_date,
      amount: `${formatMoney(Number(subscription.amount), subscription.currency)} / ${subscription.billing_frequency.replace("_", " ")}`,
    })),
    ...(purchases.data ?? []).map((purchase) => ({
      id: purchase.id,
      title: purchase.merchant,
      type: "Purchase",
      date: purchase.purchase_date,
      amount: formatMoney(Number(purchase.amount), purchase.currency),
    })),
  ]
    .filter((activity) => activity.date)
    .sort((left, right) => right.date!.localeCompare(left.date!))
    .slice(0, 5);

  function openSubscriptionDialog(subscription: CardSubscription | null = null) {
    setEditingSubscription(subscription);
    setSubscriptionDialogOpen(true);
  }

  function openPurchaseDialog(purchase: CardPurchase | null = null) {
    setEditingPurchase(purchase);
    setPurchaseDialogOpen(true);
  }

  async function confirmDeleteCard() {
    if (!card) return;
    try {
      await deleteCard.mutateAsync(card.id);
      toast.success("Card deleted");
      window.location.assign("/cards");
    } catch {
      toast.error("Couldn't delete that card. Please try again.");
    }
  }

  async function confirmDeleteSubscription() {
    if (!pendingSubscriptionDelete) return;
    try {
      await deleteSubscription.mutateAsync(pendingSubscriptionDelete.id);
      toast.success("Subscription deleted");
      setPendingSubscriptionDelete(null);
    } catch {
      toast.error("Couldn't delete that subscription. Please try again.");
    }
  }

  async function confirmDeletePurchase() {
    if (!pendingPurchaseDelete) return;
    try {
      await deletePurchase.mutateAsync(pendingPurchaseDelete.id);
      toast.success("Purchase deleted");
      setPendingPurchaseDelete(null);
    } catch {
      toast.error("Couldn't delete that purchase. Please try again.");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingState rows={4} />
      </AppShell>
    );
  }

  if (cards.isError || subscriptions.isError || purchases.isError) {
    return (
      <AppShell>
        <ErrorState
          onRetry={() =>
            void Promise.all([cards.refetch(), subscriptions.refetch(), purchases.refetch()])
          }
        />
      </AppShell>
    );
  }

  if (!card) {
    return (
      <AppShell>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This card could not be found.</p>
          <Button variant="outline" asChild>
            <Link to="/cards">Back to cards</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/70 px-4 py-3">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/cards">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to cards
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditCardOpen(true)}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete card"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmCardDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <section className="nexora-panel min-w-0 p-4 sm:p-5">
          <div className="grid min-w-0 items-center gap-5 md:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1fr)_auto]">
            <CardVisual card={card} primary={card.priority === 1} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-semibold text-foreground">{card.name}</h1>
                {card.priority === 1 && <Badge>Primary</Badge>}
              </div>
              <p className="mt-1 text-sm capitalize text-muted-foreground">
                {card.card_type} · {card.network}
              </p>
              {card.primary_use && (
                <p className="mt-3 inline-flex max-w-full items-start gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1.5 text-xs text-foreground">
                  <span className="shrink-0 font-medium text-primary">Used for:</span>
                  <span className="break-words">{card.primary_use}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 md:flex-col">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-primary/30 bg-primary/[0.08] text-sm font-semibold text-primary">
                {card.priority}
              </span>
              <span className="text-xs text-muted-foreground">Priority</span>
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <div className="min-w-0 space-y-4">
            <section className="nexora-panel min-w-0 space-y-4 p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-foreground">Card details</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex min-w-0 items-center gap-3">
                  <CreditCard className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd className="ml-auto truncate text-right text-foreground">{card.provider}</dd>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <CreditCard className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="ml-auto truncate text-right capitalize text-foreground">
                    {card.card_type}
                  </dd>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <CreditCard className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <dt className="text-muted-foreground">Network</dt>
                  <dd className="ml-auto truncate text-right capitalize text-foreground">
                    {card.network}
                  </dd>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <UserRound className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <dt className="text-muted-foreground">Assigned priority</dt>
                  <dd className="ml-auto text-right text-foreground">
                    {card.priority} {card.priority === 1 ? "(Primary)" : ""}
                  </dd>
                </div>
                <div className="flex min-w-0 items-center gap-3 sm:col-span-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <dt className="text-muted-foreground">Added</dt>
                  <dd className="ml-auto text-right text-foreground">
                    {formatDate(card.created_at.slice(0, 10))}
                  </dd>
                </div>
              </dl>
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                No real card credentials are stored or shown.
              </p>
              <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                <div className="min-w-0 rounded-lg bg-surface/80 p-2.5">
                  <dt className="text-[11px] leading-snug text-muted-foreground">Subscriptions</dt>
                  <dd className="mt-1 text-lg font-semibold text-foreground">
                    {usageSummary.activeSubscriptions}
                  </dd>
                </div>
                <div className="min-w-0 rounded-lg bg-surface/80 p-2.5">
                  <dt className="text-[11px] leading-snug text-muted-foreground">Active trials</dt>
                  <dd className="mt-1 text-lg font-semibold text-foreground">
                    {usageSummary.activeTrials}
                  </dd>
                </div>
                <div className="min-w-0 rounded-lg bg-surface/80 p-2.5">
                  <dt className="text-[11px] leading-snug text-muted-foreground">Purchases</dt>
                  <dd className="mt-1 text-lg font-semibold text-foreground">
                    {usageSummary.purchasesThisMonth}
                  </dd>
                  <dt className="text-[10px] text-muted-foreground">this month</dt>
                </div>
              </dl>
            </section>

            <section className="nexora-panel min-w-0 space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">Usage &amp; notes</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Subscriptions
                </div>
                {(subscriptions.data ?? []).length === 0 ? (
                  <p className="pl-6 text-xs text-muted-foreground">No subscriptions recorded.</p>
                ) : (
                  (subscriptions.data ?? []).slice(0, 3).map((subscription) => (
                    <div
                      key={subscription.id}
                      className="flex min-w-0 items-center gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                    >
                      <ServiceLogo name={subscription.service_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {subscription.service_name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          Started: {formatDate(subscription.start_date)}
                          {subscription.next_billing_date &&
                            ` · Next billing: ${formatDate(subscription.next_billing_date)}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-[11px] text-foreground">
                        {subscription.is_free_trial
                          ? "Free trial"
                          : `${formatMoney(Number(subscription.amount), subscription.currency)} / ${subscription.billing_frequency.replace("_", " ")}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Purchases
                </div>
                {(purchases.data ?? []).length === 0 ? (
                  <p className="pl-6 text-xs text-muted-foreground">No purchases recorded.</p>
                ) : (
                  (purchases.data ?? []).slice(0, 2).map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex min-w-0 items-center gap-3 border-b border-border/70 pb-3 last:border-0 last:pb-0"
                    >
                      <ServiceLogo name={purchase.merchant} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {purchase.merchant}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {formatDate(purchase.purchase_date)}
                          {purchase.item_description && ` · ${purchase.item_description}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-medium text-foreground">
                        {formatMoney(Number(purchase.amount), purchase.currency)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {card.notes && (
                <p className="whitespace-pre-wrap break-words border-t border-border pt-3 text-xs text-muted-foreground">
                  {card.notes}
                </p>
              )}
            </section>
          </div>

          <section className="nexora-panel min-w-0 space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Records for this card only</p>
              </div>
              <Badge variant="outline">{recentActivity.length}</Badge>
            </div>
            {recentActivity.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                Subscriptions and purchases you add will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentActivity.map((activity) => (
                  <li
                    key={`${activity.type}-${activity.id}`}
                    className="flex min-w-0 items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ServiceLogo name={activity.title} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {activity.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {activity.type} · {formatDate(activity.date)}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-right text-xs font-medium text-foreground">
                      {activity.amount}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <Tabs defaultValue="subscriptions" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="subscriptions">
              Subscriptions ({(subscriptions.data ?? []).length})
            </TabsTrigger>
            <TabsTrigger value="purchases">Purchases ({(purchases.data ?? []).length})</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Subscriptions</h2>
                <p className="text-sm text-muted-foreground">
                  Services and free trials associated with this card.
                </p>
              </div>
              <Button size="sm" onClick={() => openSubscriptionDialog()}>
                <Plus className="mr-1 h-4 w-4" />
                Add subscription
              </Button>
            </div>
            {(subscriptions.data ?? []).length === 0 ? (
              <EmptyState
                title="No subscriptions yet"
                description="Record a subscription or free trial for this card."
                actionLabel="Add subscription"
                onAction={() => openSubscriptionDialog()}
              />
            ) : (
              <div className="space-y-3">
                {(subscriptions.data ?? []).map((subscription) => (
                  <article key={subscription.id} className="nexora-panel min-w-0 space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-medium text-foreground">
                            {subscription.service_name}
                          </h3>
                          <Badge variant="outline" className="capitalize">
                            {subscription.status}
                          </Badge>
                          {subscription.is_free_trial && (
                            <Badge variant="secondary">Free trial</Badge>
                          )}
                        </div>
                        {subscription.description && (
                          <p className="mt-1 break-words text-sm text-muted-foreground">
                            {subscription.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${subscription.service_name}`}
                          onClick={() => openSubscriptionDialog(subscription)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${subscription.service_name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingSubscriptionDelete(subscription)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <p className="text-foreground">
                        {formatMoney(Number(subscription.amount), subscription.currency)} /{" "}
                        {subscription.billing_frequency.replace("_", " ")}
                      </p>
                      <p className="text-muted-foreground">
                        Started: {formatDate(subscription.start_date)}
                      </p>
                      <p className="text-muted-foreground">
                        Next billing: {formatDate(subscription.next_billing_date)}
                      </p>
                      {subscription.is_free_trial && (
                        <p className="font-medium text-primary">
                          Trial ends: {formatDate(subscription.trial_end_date)}
                        </p>
                      )}
                    </div>
                    {subscription.notes && (
                      <p className="whitespace-pre-wrap border-t border-border pt-3 text-sm text-muted-foreground">
                        {subscription.notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Purchases</h2>
                <p className="text-sm text-muted-foreground">
                  Manually recorded purchases associated with this card.
                </p>
              </div>
              <Button size="sm" onClick={() => openPurchaseDialog()}>
                <Plus className="mr-1 h-4 w-4" />
                Record purchase
              </Button>
            </div>
            {(purchases.data ?? []).length === 0 ? (
              <EmptyState
                title="No purchases yet"
                description="Record a purchase made with this card."
                actionLabel="Record purchase"
                onAction={() => openPurchaseDialog()}
              />
            ) : (
              <div className="space-y-3">
                {(purchases.data ?? []).map((purchase) => (
                  <article key={purchase.id} className="nexora-panel min-w-0 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-medium text-foreground">
                            {purchase.merchant}
                          </h3>
                          <Badge variant="secondary" className="capitalize">
                            {(purchase.purchase_type ?? "other").replace("_", " ")}
                          </Badge>
                        </div>
                        {purchase.item_description && (
                          <p className="mt-1 break-words text-sm text-muted-foreground">
                            {purchase.item_description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDate(purchase.purchase_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {formatMoney(Number(purchase.amount), purchase.currency)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit purchase from ${purchase.merchant}`}
                          onClick={() => openPurchaseDialog(purchase)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete purchase from ${purchase.merchant}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingPurchaseDelete(purchase)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {(purchase.description || purchase.notes) && (
                      <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                        {purchase.description && <p>{purchase.description}</p>}
                        {purchase.notes && <p className="whitespace-pre-wrap">{purchase.notes}</p>}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <section className="nexora-panel min-w-0 p-5">
              <h2 className="text-base font-semibold text-foreground">Card notes</h2>
              {card.notes ? (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {card.notes}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No notes added. Use Edit to add personal reminders for this card.
                </p>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <CardDialog open={editCardOpen} onOpenChange={setEditCardOpen} card={card} />
      <CardSubscriptionDialog
        open={subscriptionDialogOpen}
        onOpenChange={setSubscriptionDialogOpen}
        cardId={cardId}
        subscription={editingSubscription}
      />
      <CardPurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        cardId={cardId}
        purchase={editingPurchase}
      />
      <ConfirmDialog
        open={confirmCardDelete}
        onOpenChange={setConfirmCardDelete}
        title={`Delete ${card.name}?`}
        description="This also deletes its recorded subscriptions and purchases."
        confirmLabel={deleteCard.isPending ? "Deleting…" : "Delete card"}
        onConfirm={() => void confirmDeleteCard()}
      />
      <ConfirmDialog
        open={!!pendingSubscriptionDelete}
        onOpenChange={(open) => !open && setPendingSubscriptionDelete(null)}
        title="Delete subscription?"
        description="This removes the subscription record from this card."
        confirmLabel={deleteSubscription.isPending ? "Deleting…" : "Delete subscription"}
        onConfirm={() => void confirmDeleteSubscription()}
      />
      <ConfirmDialog
        open={!!pendingPurchaseDelete}
        onOpenChange={(open) => !open && setPendingPurchaseDelete(null)}
        title="Delete purchase?"
        description="This removes the purchase record from this card."
        confirmLabel={deletePurchase.isPending ? "Deleting…" : "Delete purchase"}
        onConfirm={() => void confirmDeletePurchase()}
      />
    </AppShell>
  );
}
