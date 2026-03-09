import { deriveBalance, deriveSpendingByCategory } from "@/features/transactions/lib/derive";
import type { StoredTransaction } from "@/features/transactions/schema";
import { toIsoDate } from "@/shared/lib/format-date";
import type { UserMemory } from "../schema";

type TransactionContext = {
  readonly type: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly description: string;
  readonly date: string;
};

type CategorySpending = {
  readonly categoryId: string;
  readonly total: number;
};

type CategoryDelta = {
  readonly categoryId: string;
  readonly current: number;
  readonly previous: number;
  readonly delta: number;
};

type ChatContext = {
  readonly transactions: readonly TransactionContext[];
  readonly summary: {
    readonly balance: number;
    readonly currentMonthSpending: readonly CategorySpending[];
    readonly previousMonthSpending: readonly CategorySpending[];
    readonly monthOverMonthDeltas: readonly CategoryDelta[];
  };
  readonly memories: readonly { readonly fact: string; readonly category: string }[];
};

const CENTS_PER_COP = 100;

function centsToCop(cents: number): number {
  return cents / CENTS_PER_COP;
}

function previousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

function computeDeltas(
  current: readonly { readonly categoryId: string; readonly totalCents: number }[],
  previous: readonly { readonly categoryId: string; readonly totalCents: number }[]
): readonly CategoryDelta[] {
  const prevMap = new Map(previous.map((p) => [p.categoryId, p.totalCents]));
  const allCategories = new Set([
    ...current.map((c) => c.categoryId),
    ...previous.map((p) => p.categoryId),
  ]);

  return Array.from(allCategories).map((categoryId) => {
    const currentCents = current.find((c) => c.categoryId === categoryId)?.totalCents ?? 0;
    const previousCents = prevMap.get(categoryId) ?? 0;
    return {
      categoryId,
      current: centsToCop(currentCents),
      previous: centsToCop(previousCents),
      delta: centsToCop(currentCents - previousCents),
    };
  });
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

  const currentSpendingCents = deriveSpendingByCategory(relevantTransactions, currentMonth);
  const previousSpendingCents = deriveSpendingByCategory(relevantTransactions, prevMonth);

  return {
    transactions: relevantTransactions.map((tx) => ({
      type: tx.type,
      amount: centsToCop(tx.amountCents),
      categoryId: tx.categoryId,
      description: tx.description,
      date: toIsoDate(tx.date),
    })),
    summary: {
      balance: centsToCop(deriveBalance(transactions)),
      currentMonthSpending: currentSpendingCents.map((c) => ({
        categoryId: c.categoryId,
        total: centsToCop(c.totalCents),
      })),
      previousMonthSpending: previousSpendingCents.map((c) => ({
        categoryId: c.categoryId,
        total: centsToCop(c.totalCents),
      })),
      monthOverMonthDeltas: computeDeltas(currentSpendingCents, previousSpendingCents),
    },
    memories: memories.map((m) => ({ fact: m.fact, category: m.category })),
  };
}
