import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useCreateCard, useUpdateCard, type Card, type CardInput } from "@/lib/nexora-data";

export function CardDialog({
  open,
  onOpenChange,
  card,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card | null;
}) {
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [cardType, setCardType] = useState("debit");
  const [network, setNetwork] = useState("visa");
  const [priority, setPriority] = useState("1");
  const [primaryUse, setPrimaryUse] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(card?.name ?? "");
    setProvider(card?.provider ?? "");
    setCardType(card?.card_type ?? "debit");
    setNetwork(card?.network ?? "visa");
    setPriority(String(card?.priority ?? 1));
    setPrimaryUse(card?.primary_use ?? "");
    setNotes(card?.notes ?? "");
  }, [card, open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const priorityValue = Number(priority);
    if (!name.trim() || !provider.trim()) {
      toast.error("Enter a card name and provider");
      return;
    }
    if (!Number.isSafeInteger(priorityValue) || priorityValue < 1) {
      toast.error("Priority must be a whole number greater than zero");
      return;
    }

    const values: CardInput = {
      name: name.trim(),
      provider: provider.trim(),
      card_type: cardType,
      network,
      priority: priorityValue,
      primary_use: primaryUse.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (card) {
        await updateCard.mutateAsync({ id: card.id, ...values });
        toast.success("Card updated");
      } else {
        await createCard.mutateAsync(values);
        toast.success("Card added");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error && /unique|priority/i.test(error.message)
          ? "That priority number is already assigned. Choose another number."
          : "Couldn't save that card. Please try again.",
      );
    }
  }

  const pending = createCard.isPending || updateCard.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? "Edit card" : "Add card"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-name">Card name</Label>
            <Input
              id="card-name"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Everyday card"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="card-provider">Provider / source</Label>
              <Input
                id="card-provider"
                maxLength={100}
                required
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                placeholder="Meru, Handypay, or another provider"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-priority">Priority number</Label>
              <Input
                id="card-priority"
                type="number"
                min="1"
                step="1"
                required
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">Lower numbers = higher priority.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-type">Card type</Label>
              <Select value={cardType} onValueChange={setCardType}>
                <SelectTrigger id="card-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-network">Card network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger id="card-network">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa</SelectItem>
                  <SelectItem value="mastercard">Mastercard</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-primary-use">Primary use (optional)</Label>
            <Input
              id="card-primary-use"
              maxLength={240}
              value={primaryUse}
              onChange={(event) => setPrimaryUse(event.target.value)}
              placeholder="Daily expenses, online purchases"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-notes">Notes (optional)</Label>
            <Textarea
              id="card-notes"
              rows={3}
              maxLength={4000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            Nexora stores card details for personal organization only. Never enter a card number,
            security code, PIN, expiration date, or banking password.
          </p>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : card ? "Save changes" : "Add card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
