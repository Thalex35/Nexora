import type {
  Debt,
  FutureExpense,
  IncomeAllocation,
  Transaction,
} from "@/lib/nexora-data";

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

export function toggleDebtStatus(
  status: Debt["status"],
  paidDate: string,
): Pick<Debt, "status" | "paid_date"> {
  return status === "unpaid"
    ? { status: "paid", paid_date: paidDate }
    : { status: "unpaid", paid_date: null };
}

const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function currentFinanceMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftFinanceMonth(month: string, offset: number) {
  const [year, monthNumber] = parseFinanceMonth(month);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthDateRange(month: string) {
  const [year, monthNumber] = parseFinanceMonth(month);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function parseFinanceMonth(month: string): [number, number] {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error(`Invalid finance month: ${month}`);
  return [Number(match[1]), Number(match[2])];
}

export function monthlyFinanceTotals(
  transactions: Transaction[],
  allocations: IncomeAllocation[],
  futureExpenses: FutureExpense[],
  debts: Debt[],
  month: string,
) {
  const monthTransactions = transactions.filter((transaction) =>
    transaction.transaction_date.startsWith(`${month}-`),
  );
  const incomes = monthTransactions.filter((transaction) => transaction.type === "income");
  const expenses = monthTransactions.filter((transaction) => transaction.type === "expense");
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
  const plannedFutureExpenses = futureExpenses.filter(
    (expense) =>
      expense.planned_date.startsWith(`${month}-`) && expense.status === "planned",
  );
  const monthDebts = debts.filter((debt) => debt.debt_date.startsWith(`${month}-`));
  const outstandingDebts = monthDebts.filter((debt) => debt.status === "unpaid");

  return {
    totalIncome,
    totalExpenses,
    totalAllocated,
    futureExpenses: roundMoney(
      plannedFutureExpenses.reduce((total, expense) => total + Number(expense.amount), 0),
    ),
    outstandingDebts: roundMoney(
      outstandingDebts.reduce((total, debt) => total + Number(debt.amount), 0),
    ),
    remainingBalance: roundMoney(totalIncome - totalExpenses - totalAllocated),
    incomeById,
    incomes,
    expenses,
    plannedFutureExpenses,
    monthFutureExpenses: futureExpenses.filter((expense) =>
      expense.planned_date.startsWith(`${month}-`),
    ),
    monthDebts,
  };
}

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
