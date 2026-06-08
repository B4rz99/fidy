import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { buildCalendarMonthSummary, type CalendarBillOccurrence } from "../lib/calendar-utils";
import type { Bill, BillPayment } from "../schema";
import { CalendarBillRow } from "./CalendarBillRow";
import { CalendarGrid } from "./CalendarGrid";
import { MonthNavigator } from "./MonthNavigator";

type CalendarMonthBoardProps = {
  readonly bills: readonly Bill[];
  readonly cellMinHeight?: number;
  readonly currentMonth: Date;
  readonly onBillDelete?: (bill: Bill) => void;
  readonly onBillEdit?: (bill: Bill) => void;
  readonly onBillPaymentToggle?: (occurrence: CalendarBillOccurrence) => void;
  readonly onDayPress: (date: Date) => void;
  readonly onNextMonth: () => void;
  readonly onPrevMonth: () => void;
  readonly payments: readonly BillPayment[];
  readonly paddingBottom?: number;
  readonly paddingTop?: number;
};

export function CalendarMonthBoard({
  bills,
  cellMinHeight,
  currentMonth,
  onBillDelete,
  onBillEdit,
  onBillPaymentToggle,
  onDayPress,
  onNextMonth,
  onPrevMonth,
  paddingBottom = 32,
  paddingTop = 0,
  payments,
}: CalendarMonthBoardProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const peach = useThemeColor("peach");
  const secondaryColor = useThemeColor("secondary");

  const monthSummary = useMemo(
    () => buildCalendarMonthSummary({ bills, currentMonth, payments }),
    [bills, currentMonth, payments]
  );

  return (
    <View style={[styles.board, { paddingTop }]}>
      <MonthNavigator currentMonth={currentMonth} onPrev={onPrevMonth} onNext={onNextMonth} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        alwaysBounceVertical={false}
      >
        <View style={styles.calendarFrame}>
          <CalendarGrid
            currentMonth={currentMonth}
            bills={bills}
            payments={payments}
            cellMinHeight={cellMinHeight}
            onDayPress={onDayPress}
          />
        </View>
        <View style={styles.legendRow}>
          <Text style={[styles.legendText, { color: secondaryColor }]}>
            <Text style={{ color: accentGreen }}>●</Text> {t("calendar.paid")}
          </Text>
          <Text style={[styles.legendText, { color: secondaryColor }]}>
            <Text style={{ color: peach }}>●</Text> {t("calendar.pending")}
          </Text>
        </View>
        {monthSummary.monthOccurrences.length > 0 ? (
          <View style={styles.billList}>
            {monthSummary.monthOccurrences.map((occurrence) => (
              <CalendarBillRow
                key={`${occurrence.bill.id}-${occurrence.dueDate}`}
                occurrence={occurrence}
                onDelete={onBillDelete}
                onEdit={onBillEdit}
                onPaymentToggle={onBillPaymentToggle}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  calendarFrame: {
    minHeight: 420,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  legendText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  billList: {
    gap: 8,
  },
});
