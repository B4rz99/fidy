import { deriveBalance, deriveSpendingByCategory } from "@/features/transactions/lib/derive";
import type { StoredTransaction } from "@/features/transactions/schema";
import { toIsoDate } from "@/shared/lib/format-date";
import type { UserMemory } from "../schema";

type TransactionContext = {
  readonly type: string;
  readonly amountCents: number;
  readonly categoryId: string;
  readonly description: string;
  readonly date: string;
};

type ChatContext = {
  readonly transactions: readonly TransactionContext[];
  readonly summary: {
    readonly balance: number;
    readonly currentMonthSpending: readonly {
      readonly categoryId: string;
      readonly totalCents: number;
    }[];
    readonly previousMonthSpending: readonly {
      readonly categoryId: string;
      readonly totalCents: number;
    }[];
  };
  readonly memories: readonly { readonly fact: string; readonly category: string }[];
};

function previousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

export function buildChatContext(
  transactions: readonly StoredTransaction[],
  memories: readonly UserMemory[],
  currentMonth: string
): ChatContext {
  const prevMonth = previousMonth(currentMonth);

  const relevantTransactions = transactions.filter((tx) => {
    const isoDate = toIsoDate(tx.date);
    return isoDate.startsWith(currentMonth) || isoDate.startsWith(prevMonth);
  });

  return {
    transactions: relevantTransactions.map((tx) => ({
      type: tx.type,
      amountCents: tx.amountCents,
      categoryId: tx.categoryId,
      description: tx.description,
      date: toIsoDate(tx.date),
    })),
    summary: {
      balance: deriveBalance(transactions),
      currentMonthSpending: deriveSpendingByCategory(relevantTransactions, currentMonth),
      previousMonthSpending: deriveSpendingByCategory(relevantTransactions, prevMonth),
    },
    memories: memories.map((m) => ({ fact: m.fact, category: m.category })),
  };
}
