import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import type { CalendarDay } from "../lib/calendar-utils";
import { getBillsForDate, getMonthGrid, WEEKDAY_LABELS } from "../lib/calendar-utils";
import type { Bill } from "../schema";
import { CalendarDayCell } from "./CalendarDayCell";

type Props = {
  currentMonth: Date;
  bills: Bill[];
  onBillPress: (id: string) => void;
};

export function CalendarGrid({ currentMonth, bills, onBillPress }: Props) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const billsByDate = useMemo(
    () =>
      new Map(
        grid
          .flat()
          .filter((cell): cell is CalendarDay & { date: Date } => cell.date !== null)
          .map((cell) => [cell.date.toISOString(), getBillsForDate(bills, cell.date)] as const)
      ),
    [grid, bills]
  );

  const borderColor = useThemeColor("borderSubtle");
  const cardBg = useThemeColor("card");
  const tertiaryColor = useThemeColor("tertiary");

  return (
    <View style={[styles.container, { borderColor, backgroundColor: cardBg }]}>
      {/* Weekday header */}
      <View style={styles.headerRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static weekday labels never reorder
          <View key={i} style={styles.headerCell}>
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
              bills={cell.date ? (billsByDate.get(cell.date.toISOString()) ?? []) : []}
              onBillPress={onBillPress}
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
