import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCardPurchase,
  useCreateCardSubscription,
  useUpdateCardPurchase,
  useUpdateCardSubscription,
  type CardPurchase,
  type CardPurchaseInput,
  type CardSubscription,
  type CardSubscriptionInput,
} from "@/lib/nexora-data";

export function CardSubscriptionDialog({
  open,
  onOpenChange,
  cardId,
  subscription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  subscription: CardSubscription | null;
}) {
  const createSubscription = useCreateCardSubscription();
  const updateSubscription = useUpdateCardSubscription();
  const [serviceName, setServiceName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [nextBillingDate, setNextBillingDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("active");
  const [isTrial, setIsTrial] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState("");
  const [trialEndDate, setTrialEndDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setServiceName(subscription?.service_name ?? "");
    setDescription(subscription?.description ?? "");
    setAmount(subscription ? String(subscription.amount) : "");
    setCurrency(subscription?.currency ?? "USD");
    setFrequency(subscription?.billing_frequency ?? "monthly");
    setStartDate(subscription?.start_date ?? "");
    setNextBillingDate(subscription?.next_billing_date ?? "");
    setEndDate(subscription?.end_date ?? "");
    setStatus(subscription?.status ?? "active");
    setIsTrial(subscription?.is_free_trial ?? false);
    setTrialStartDate(subscription?.trial_start_date ?? "");
    setTrialEndDate(subscription?.trial_end_date ?? "");
    setNotes(subscription?.notes ?? "");
  }, [open, subscription]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!/^[a-z]{3}$/i.test(currency.trim())) {
      toast.error("Enter a valid three-letter currency code");
      return;
    }
    if (isTrial && trialStartDate && trialEndDate && trialEndDate < trialStartDate) {
      toast.error("Trial end date must be on or after the trial start date");
      return;
    }
    const values: CardSubscriptionInput = {
      card_id: cardId,
      service_name: serviceName.trim(),
      description: description.trim() || null,
      amount: Math.round((amountValue + Number.EPSILON) * 100) / 100,
      currency: currency.trim().toUpperCase(),
      billing_frequency: frequency,
      start_date: startDate || null,
      next_billing_date: nextBillingDate || null,
      end_date: endDate || null,
      status,
      is_free_trial: isTrial,
      trial_start_date: isTrial ? trialStartDate || null : null,
      trial_end_date: isTrial ? trialEndDate || null : null,
      notes: notes.trim() || null,
    };
    try {
      if (subscription) {
        await updateSubscription.mutateAsync({ id: subscription.id, ...values });
        toast.success("Subscription updated");
      } else {
        await createSubscription.mutateAsync(values);
        toast.success("Subscription added");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that subscription. Please try again.");
    }
  }

  const pending = createSubscription.isPending || updateSubscription.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subscription ? "Edit subscription" : "Add subscription"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-subscription-service">Service / app</Label>
            <Input
              id="card-subscription-service"
              maxLength={160}
              required
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              placeholder="Streaming service"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-subscription-description">Description (optional)</Label>
            <Textarea
              id="card-subscription-description"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="card-subscription-amount">Amount</Label>
              <Input
                id="card-subscription-amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-subscription-currency">Currency code</Label>
              <Input
                id="card-subscription-currency"
                maxLength={3}
                minLength={3}
                required
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                placeholder="USD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-subscription-frequency">Billing frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="card-subscription-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="one_time">One time</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-subscription-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="card-subscription-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-subscription-start">Start date</Label>
              <Input
                id="card-subscription-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-subscription-next-billing">Next billing date</Label>
              <Input
                id="card-subscription-next-billing"
                type="date"
                value={nextBillingDate}
                onChange={(event) => setNextBillingDate(event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="card-subscription-end">End / cancellation date</Label>
              <Input
                id="card-subscription-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={isTrial}
              onCheckedChange={(checked) => setIsTrial(checked === true)}
            />
            This subscription is currently in a free trial
          </label>
          {isTrial && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="card-subscription-trial-start">Trial start</Label>
                <Input
                  id="card-subscription-trial-start"
                  type="date"
                  value={trialStartDate}
                  onChange={(event) => setTrialStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-subscription-trial-end">Trial ends</Label>
                <Input
                  id="card-subscription-trial-end"
                  type="date"
                  value={trialEndDate}
                  onChange={(event) => setTrialEndDate(event.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="card-subscription-notes">Notes (optional)</Label>
            <Textarea
              id="card-subscription-notes"
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : subscription ? "Save changes" : "Add subscription"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CardPurchaseDialog({
  open,
  onOpenChange,
  cardId,
  purchase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  purchase: CardPurchase | null;
}) {
  const createPurchase = useCreateCardPurchase();
  const updatePurchase = useUpdateCardPurchase();
  const [merchant, setMerchant] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [date, setDate] = useState("");
  const [purchaseType, setPurchaseType] = useState("other");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setMerchant(purchase?.merchant ?? "");
    setItemDescription(purchase?.item_description ?? "");
    setAmount(purchase ? String(purchase.amount) : "");
    setCurrency(purchase?.currency ?? "USD");
    setDate(purchase?.purchase_date ?? new Date().toISOString().slice(0, 10));
    setPurchaseType(purchase?.purchase_type ?? "other");
    setDescription(purchase?.description ?? "");
    setNotes(purchase?.notes ?? "");
  }, [open, purchase]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountValue = Number(amount);
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!/^[a-z]{3}$/i.test(currency.trim())) {
      toast.error("Enter a valid three-letter currency code");
      return;
    }
    const values: CardPurchaseInput = {
      card_id: cardId,
      merchant: merchant.trim(),
      item_description: itemDescription.trim(),
      amount: Math.round((amountValue + Number.EPSILON) * 100) / 100,
      currency: currency.trim().toUpperCase(),
      purchase_date: date,
      purchase_type: purchaseType,
      description: description.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      if (purchase) {
        await updatePurchase.mutateAsync({ id: purchase.id, ...values });
        toast.success("Purchase updated");
      } else {
        await createPurchase.mutateAsync(values);
        toast.success("Purchase recorded");
      }
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that purchase. Please try again.");
    }
  }

  const pending = createPurchase.isPending || updatePurchase.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{purchase ? "Edit purchase" : "Record purchase"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="card-purchase-merchant">Merchant / app</Label>
              <Input
                id="card-purchase-merchant"
                maxLength={160}
                required
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-purchase-item">What was purchased (optional)</Label>
              <Input
                id="card-purchase-item"
                maxLength={240}
                value={itemDescription}
                onChange={(event) => setItemDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-purchase-amount">Amount</Label>
              <Input
                id="card-purchase-amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-purchase-currency">Currency code</Label>
              <Input
                id="card-purchase-currency"
                maxLength={3}
                minLength={3}
                required
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-purchase-date">Purchase date</Label>
              <Input
                id="card-purchase-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-purchase-type">Type</Label>
              <Select value={purchaseType} onValueChange={setPurchaseType}>
                <SelectTrigger id="card-purchase-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="in_store">In-store</SelectItem>
                  <SelectItem value="app_digital">App / digital</SelectItem>
                  <SelectItem value="subscription">Subscription</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-purchase-description">Description (optional)</Label>
            <Textarea
              id="card-purchase-description"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-purchase-notes">Notes (optional)</Label>
            <Textarea
              id="card-purchase-notes"
              rows={2}
              maxLength={4000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : purchase ? "Save changes" : "Record purchase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
