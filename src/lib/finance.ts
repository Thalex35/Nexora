import type { IncomeAllocation, Transaction } from "@/lib/nexora-data";

export function allocationAmount(
  allocation: Pick<IncomeAllocation, "allocation_type" | "value">,
  incomeAmount: number,
) {
  const amount =
    allocation.allocation_type === "percentage"
      ? (incomeAmount * allocation.value) / 100
      : allocation.value;
  return roundMoney(amount);
}

const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function financeTotals(transactions: Transaction[], allocations: IncomeAllocation[]) {
  const incomes = transactions.filter((transaction) => transaction.type === "income");
  const expenses = transactions.filter((transaction) => transaction.type === "expense");
  const incomeById = new Map(incomes.map((income) => [income.id, Number(income.amount)]));
  const totalIncome = roundMoney(
    incomes.reduce((total, income) => total + Number(income.amount), 0),
  );
  const totalExpenses = roundMoney(
    expenses.reduce((total, expense) => total + Number(expense.amount), 0),
  );
  const totalAllocated = roundMoney(
    allocations.reduce(
      (total, allocation) =>
        total + allocationAmount(allocation, incomeById.get(allocation.income_id) ?? 0),
      0,
    ),
  );

  return {
    totalIncome,
    totalExpenses,
    availableBalance: roundMoney(totalIncome - totalExpenses),
    totalAllocated,
    unallocatedIncome: roundMoney(totalIncome - totalAllocated),
    incomeById,
  };
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatFinanceDate(date: string | null) {
  if (!date) return "No date";
  return new Date(`${date}T00:00:00`).toLocaleDateString();
}
