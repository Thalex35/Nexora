import type { Card, CardPurchase, CardSubscription } from "@/lib/nexora-data";

export function sortCardsByPriority<T extends Pick<Card, "id" | "priority">>(cards: T[]) {
  return [...cards].sort(
    (left, right) => left.priority - right.priority || left.id.localeCompare(right.id),
  );
}

export function summarizeCardUsage(
  subscriptions: Pick<CardSubscription, "status" | "is_free_trial">[],
  purchases: Pick<CardPurchase, "purchase_date">[],
  now = new Date(),
) {
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active");

  return {
    activeSubscriptions: activeSubscriptions.length,
    activeTrials: activeSubscriptions.filter((item) => item.is_free_trial).length,
    purchasesThisMonth: purchases.filter((purchase) => {
      const date = new Date(`${purchase.purchase_date}T00:00:00`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    }).length,
  };
}
