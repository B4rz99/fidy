import type { Locale } from "date-fns";
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

export function makeDateLabel(
  date: Date,
  todayLabel = "Today",
  yesterdayLabel = "Yesterday",
  dateFnsLocale?: Locale
): string {
  if (isToday(date)) return todayLabel;
  if (isYesterday(date)) return yesterdayLabel;
  return format(date, "MMMM d", dateFnsLocale ? { locale: dateFnsLocale } : undefined);
}

export function buildListData(
  transactions: readonly StoredTransaction[],
  todayLabel = "Today",
  yesterdayLabel = "Yesterday",
  dateFnsLocale?: Locale
): {
  readonly items: ListItem[];
  readonly stickyIndices: number[];
} {
  // Local mutation for O(n) performance on the render path (CLAUDE.md performance exemption).
  const items: ListItem[] = [];
  const stickyIndices: number[] = [];

  transactions.reduce<string | null>((prev, tx) => {
    const dateKey = toIsoDate(tx.date);
    if (dateKey !== prev) {
      stickyIndices.push(items.length);
      items.push({
        kind: "date-header" as const,
        label: makeDateLabel(tx.date, todayLabel, yesterdayLabel, dateFnsLocale),
        dateKey,
      });
    }
    items.push(tx);
    return dateKey;
  }, null);

  return { items, stickyIndices };
}
