import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { CardDialog } from "@/components/card-dialog";
import { CardPurchaseDialog, CardSubscriptionDialog } from "@/components/card-usage-dialogs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { PageHeader } from "@/components/page-header";
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
        <PageHeader
          title={card.name}
          description={`${card.provider} · ${card.card_type} · ${card.network}`}
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/cards">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Cards
              </Link>
            </Button>
          }
        />

        <section className="nexora-panel min-w-0 space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
                {card.provider}
              </p>
              <h2 className="mt-1 break-words text-xl font-semibold text-foreground">
                {card.name}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">Priority {card.priority}</Badge>
                <Badge variant="secondary" className="capitalize">
                  {card.card_type}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {card.network}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
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

          {card.primary_use && (
            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">Primary use</p>
              <p className="mt-1 break-words text-sm text-foreground">{card.primary_use}</p>
            </div>
          )}

          <dl className="grid grid-cols-1 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-surface p-3">
              <dt className="text-xs text-muted-foreground">Active subscriptions</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {usageSummary.activeSubscriptions}
              </dd>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <dt className="text-xs text-muted-foreground">Active free trials</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {usageSummary.activeTrials}
              </dd>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <dt className="text-xs text-muted-foreground">Purchases this month</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {usageSummary.purchasesThisMonth}
              </dd>
            </div>
          </dl>
        </section>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subscriptions">
              Subscriptions ({(subscriptions.data ?? []).length})
            </TabsTrigger>
            <TabsTrigger value="purchases">Purchases ({(purchases.data ?? []).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <section className="nexora-panel space-y-2 p-5">
              <h2 className="text-base font-semibold text-foreground">Card details</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd className="mt-1 text-foreground">{card.provider}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd className="mt-1 text-foreground">{card.priority} · lower is higher</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-foreground">
                    {formatDate(card.created_at.slice(0, 10))}
                  </dd>
                </div>
              </dl>
              {card.notes && (
                <div className="border-t border-border pt-3">
                  <h3 className="text-xs text-muted-foreground">Notes</h3>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                    {card.notes}
                  </p>
                </div>
              )}
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                For your safety, Nexora does not store or display actual card credentials.
              </p>
            </section>
          </TabsContent>

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
