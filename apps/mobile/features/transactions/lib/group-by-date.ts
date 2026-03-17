import { format, isToday, isYesterday } from "date-fns";
import { toIsoDate } from "@/shared/lib";
import type { StoredTransaction } from "../schema";

export type DateHeader = {
  readonly kind: "date-header";
  readonly label: string;
  readonly dateKey: string;
};

export type ListItem = DateHeader | StoredTransaction;

export function isDateHeader(item: ListItem): item is DateHeader {
  return "kind" in item && item.kind === "date-header";
}

export function makeDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d");
}

export function buildListData(transactions: readonly StoredTransaction[]): {
  readonly items: ListItem[];
  readonly stickyIndices: number[];
} {
  const items: ListItem[] = [];
  const stickyIndices: number[] = [];

  transactions.reduce<string | null>((lastDateKey, tx) => {
    const dateKey = toIsoDate(tx.date);

    if (dateKey !== lastDateKey) {
      stickyIndices.push(items.length);
      items.push({
        kind: "date-header",
        label: makeDateLabel(tx.date),
        dateKey,
      });
    }

    items.push(tx);
    return dateKey;
  }, null);

  return { items, stickyIndices };
}
