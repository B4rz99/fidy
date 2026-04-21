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
type DateLabelInput = {
  readonly date: Date;
  readonly todayLabel?: string;
  readonly yesterdayLabel?: string;
  readonly dateFnsLocale?: Locale;
};
type DateLabelOptions = Omit<DateLabelInput, "date">;
type BuildListDataInput = {
  readonly transactions: readonly StoredTransaction[];
  readonly todayLabel?: string;
  readonly yesterdayLabel?: string;
  readonly dateFnsLocale?: Locale;
};

export function isDateHeader(item: ListItem): item is DateHeader {
  return "kind" in item;
}

export function makeDateLabel({
  date,
  todayLabel = "Today",
  yesterdayLabel = "Yesterday",
  dateFnsLocale,
}: DateLabelInput): string {
  if (isToday(date)) return todayLabel;
  if (isYesterday(date)) return yesterdayLabel;
  return format(date, "MMMM d", dateFnsLocale ? { locale: dateFnsLocale } : undefined);
}

function buildDateHeader(transaction: StoredTransaction, options: DateLabelOptions): DateHeader {
  return {
    kind: "date-header",
    label: makeDateLabel({ date: transaction.date, ...options }),
    dateKey: toIsoDate(transaction.date),
  };
}

export function buildListData(input: BuildListDataInput): {
  readonly items: ListItem[];
  readonly stickyIndices: number[];
} {
  const { transactions, todayLabel = "Today", yesterdayLabel = "Yesterday", dateFnsLocale } = input;
  // Local mutation for O(n) performance on the render path (CLAUDE.md performance exemption).
  const items: ListItem[] = [];
  const stickyIndices: number[] = [];
  const labelOptions = { todayLabel, yesterdayLabel, dateFnsLocale };

  transactions.reduce<string | null>((prev, tx) => {
    const dateKey = toIsoDate(tx.date);
    if (dateKey !== prev) {
      stickyIndices.push(items.length);
      items.push(buildDateHeader(tx, labelOptions));
    }
    items.push(tx);
    return dateKey;
  }, null);

  return { items, stickyIndices };
}
