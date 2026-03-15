import { format, isToday, isYesterday } from "date-fns";
import { toIsoDate } from "@/shared/lib/format-date";
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

function makeDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d");
}

export function buildListData(transactions: readonly StoredTransaction[]): {
  readonly items: ListItem[];
  readonly stickyIndices: number[];
} {
  const result = transactions.reduce<{
    readonly items: ListItem[];
    readonly stickyIndices: number[];
    readonly lastDateKey: string | null;
  }>(
    (acc, tx) => {
      const dateKey = toIsoDate(tx.date);

      if (dateKey === acc.lastDateKey) {
        return {
          ...acc,
          items: [...acc.items, tx],
        };
      }

      const header: DateHeader = {
        kind: "date-header",
        label: makeDateLabel(tx.date),
        dateKey,
      };
      const headerIndex = acc.items.length;

      return {
        items: [...acc.items, header, tx],
        stickyIndices: [...acc.stickyIndices, headerIndex],
        lastDateKey: dateKey,
      };
    },
    { items: [], stickyIndices: [], lastDateKey: null }
  );

  return { items: result.items, stickyIndices: result.stickyIndices };
}
