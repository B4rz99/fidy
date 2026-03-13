import { format } from "date-fns";
import { toIsoDate } from "@/shared/lib/format-date";
import type { StoredTransaction } from "../schema";

type DateHeader = {
  readonly type: "section-header";
  readonly date: string;
  readonly label: string;
};
type TransactionItem = {
  readonly type: "transaction";
  readonly data: StoredTransaction;
};
export type TransactionListItem = DateHeader | TransactionItem;

const formatLabel = (isoDate: string, today: string, yesterday: string): string =>
  isoDate === today
    ? "Today"
    : isoDate === yesterday
      ? "Yesterday"
      : format(new Date(`${isoDate}T12:00:00`), "MMM d, yyyy");

export function groupTransactionsByDate(
  transactions: readonly StoredTransaction[],
  now: Date
): readonly TransactionListItem[] {
  const today = toIsoDate(now);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = toIsoDate(yesterdayDate);

  const grouped = Map.groupBy(transactions, (tx) => toIsoDate(tx.date));

  return Array.from(grouped, ([dateKey, txs]): readonly TransactionListItem[] => [
    { type: "section-header" as const, date: dateKey, label: formatLabel(dateKey, today, yesterday) },
    ...txs.map((data): TransactionItem => ({ type: "transaction" as const, data })),
  ]).flat();
}
