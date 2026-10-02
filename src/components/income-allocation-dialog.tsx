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
import {
  useCreateIncomeAllocation,
  useUpdateIncomeAllocation,
  type AllocationType,
  type IncomeAllocation,
} from "@/lib/nexora-data";
import { allocationAmount, formatMoney } from "@/lib/finance";

export function IncomeAllocationDialog({
  open,
  incomeId,
  incomeAmount,
  allocation,
  onClose,
}: {
  open: boolean;
  incomeId: string;
  incomeAmount: number;
  allocation: IncomeAllocation | null;
  onClose: () => void;
}) {
  const createAllocation = useCreateIncomeAllocation();
  const updateAllocation = useUpdateIncomeAllocation();
  const [title, setTitle] = useState("");
  const [allocationType, setAllocationType] = useState<AllocationType>("fixed");
  const [value, setValue] = useState("");
  const [plannedDate, setPlannedDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(allocation?.title ?? "");
    setAllocationType(allocation?.allocation_type ?? "fixed");
    setValue(allocation ? String(allocation.value) : "");
    setPlannedDate(allocation?.planned_date ?? "");
  }, [allocation, open]);

  const numericValue = Number(value);
  const preview =
    Number.isFinite(numericValue) && numericValue > 0
      ? allocationAmount({ allocation_type: allocationType, value: numericValue }, incomeAmount)
      : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !Number.isFinite(numericValue) || numericValue <= 0) {
      toast.error("Enter a name and valid allocation value");
      return;
    }
    if (allocationType === "percentage" && numericValue > 100) {
      toast.error("A percentage must be 100% or less");
      return;
    }
    try {
      const values = {
        title: title.trim(),
        allocation_type: allocationType,
        value: Math.round((numericValue + Number.EPSILON) * 100) / 100,
        planned_date: plannedDate || null,
      };
      if (allocation) {
        await updateAllocation.mutateAsync({ id: allocation.id, ...values });
        toast.success("Allocation updated");
      } else {
        await createAllocation.mutateAsync({ ...values, income_id: incomeId });
        toast.success("Allocation added");
      }
      onClose();
    } catch {
      toast.error("Couldn't save that allocation. Please try again.");
    }
  }

  const pending = createAllocation.isPending || updateAllocation.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{allocation ? "Edit allocation" : "Plan an allocation"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allocation-title">Name</Label>
            <Input
              id="allocation-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Rent, savings, supplies…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="allocation-type">Type</Label>
              <Select
                value={allocationType}
                onValueChange={(next) => setAllocationType(next as AllocationType)}
              >
                <SelectTrigger id="allocation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allocation-value">
                {allocationType === "percentage" ? "Percentage (%)" : "Amount"}
              </Label>
              <Input
                id="allocation-value"
                type="number"
                min="0.01"
                max={allocationType === "percentage" ? 100 : undefined}
                step="0.01"
                required
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
          </div>
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Planned amount:{" "}
            <span className="font-semibold text-foreground">
              {preview === null ? "Enter a value" : formatMoney(preview)}
            </span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="allocation-date">Planned date (optional)</Label>
            <Input
              id="allocation-date"
              type="date"
              value={plannedDate}
              onChange={(event) => setPlannedDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : allocation ? "Save changes" : "Add allocation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
