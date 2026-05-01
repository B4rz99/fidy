import { useMemo } from "react";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { toIsoDate } from "@/shared/lib";
import { getBillsForDate, getMonthGrid } from "../lib/calendar-utils";
import type { Bill, BillPayment } from "../schema";
import { CalendarDayCell } from "./CalendarDayCell";

type Props = {
  currentMonth: Date;
  bills: Bill[];
  payments: BillPayment[];
  cellMinHeight?: number;
  onDayPress: (date: Date) => void;
};

export function CalendarGrid({ currentMonth, bills, payments, cellMinHeight, onDayPress }: Props) {
  const { t } = useTranslation();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const weekdayLabels = useMemo(
    () => [
      t("calendar.weekdays.mon"),
      t("calendar.weekdays.tue"),
      t("calendar.weekdays.wed"),
      t("calendar.weekdays.thu"),
      t("calendar.weekdays.fri"),
      t("calendar.weekdays.sat"),
      t("calendar.weekdays.sun"),
    ],
    [t]
  );

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const billsByDate = useMemo(
    () =>
      new Map(
        grid
          .flat()
          .reduce<Array<readonly [string, Bill[]]>>(
            (entries, cell) =>
              cell.date
                ? [...entries, [cell.date.toISOString(), getBillsForDate(bills, cell.date)]]
                : entries,
            []
          )
      ),
    [grid, bills]
  );

  const paidBillIdsByDate = useMemo(() => {
    const map = new Map<string, ReadonlySet<string>>();
    for (const cell of grid.flat()) {
      if (!cell.date) continue;
      const dateKey = toIsoDate(cell.date);
      const cellBills = billsByDate.get(cell.date.toISOString()) ?? [];
      const paidIds = new Set(
        cellBills.reduce<string[]>(
          (ids, bill) =>
            payments.some((payment) => payment.billId === bill.id && payment.dueDate === dateKey)
              ? [...ids, bill.id]
              : ids,
          []
        )
      );
      map.set(cell.date.toISOString(), paidIds);
    }
    return map;
  }, [grid, billsByDate, payments]);

  const borderColor = useThemeColor("borderSubtle");
  const cardBg = useThemeColor("card");
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <View style={[styles.container, { borderColor, backgroundColor: cardBg }]}>
      {/* Weekday header */}
      <View style={styles.headerRow}>
        {weekdayLabels.map((label) => (
          <View key={label} style={styles.headerCell}>
            <Text style={[styles.headerText, { color: tertiaryColor }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {grid.map((week, weekIdx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: grid rows are positional by week
        <View key={weekIdx} style={styles.weekRow}>
          {week.map((cell, dayIdx) => (
            <CalendarDayCell
              key={cell.day ?? `empty-${dayIdx}`}
              day={cell.day}
              date={cell.date}
              bills={cell.date ? (billsByDate.get(cell.date.toISOString()) ?? []) : []}
              paidBillIds={
                cell.date
                  ? (paidBillIdsByDate.get(cell.date.toISOString()) ?? new Set())
                  : new Set()
              }
              minHeight={cellMinHeight}
              onDayPress={onDayPress}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    paddingVertical: 8,
  },
  headerCell: {
    flex: 1,
    alignItems: "center",
  },
  headerText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  weekRow: {
    flexDirection: "row",
  },
});
