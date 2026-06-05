import { format } from "date-fns";
import { useMemo } from "react";
import { getBuiltInCategory } from "@/shared/categories";
import { GlassSurface } from "@/shared/components";
import { Check, Pencil, Trash2 } from "@/shared/components/icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import { buildCalendarMonthSummary, type CalendarBillOccurrence } from "../lib/calendar-utils";
import type { Bill, BillPayment } from "../schema";
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
  const { locale, t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentRed = useThemeColor("accentRed");
  const peach = useThemeColor("peach");
  const peachBg = useThemeColor("peachLight");
  const primaryColor = useThemeColor("primary");
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
            {monthSummary.monthOccurrences.map((occurrence) => {
              const { bill, dueDate, isPaid } = occurrence;
              const category = getBuiltInCategory(bill.categoryId);
              return (
                <GlassSurface
                  key={`${bill.id}-${dueDate}`}
                  padded={false}
                  radius={18}
                  style={[styles.billCard, isPaid ? { backgroundColor: accentGreenLight } : null]}
                >
                  <View style={styles.billRow}>
                    <View style={styles.billMain}>
                      <Text style={styles.billIcon}>{category.icon}</Text>
                      <View style={styles.billCopy}>
                        <Text
                          style={[
                            styles.billName,
                            { color: primaryColor },
                            isPaid && styles.paidText,
                          ]}
                          numberOfLines={1}
                        >
                          {bill.name}
                        </Text>
                        <Text style={[styles.billMeta, { color: secondaryColor }]}>
                          {format(new Date(`${dueDate}T00:00:00`), "d MMM", {
                            locale: getDateFnsLocale(locale),
                          })}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.billAmount, { color: primaryColor }]}>
                      {formatMoney(bill.amount)}
                    </Text>
                  </View>
                  <View style={styles.cardFooter}>
                    <Text
                      style={[
                        styles.statusPill,
                        {
                          color: isPaid ? accentGreen : peach,
                          backgroundColor: isPaid ? `${accentGreen}1A` : `${peach}1A`,
                        },
                      ]}
                    >
                      {isPaid ? t("calendar.paid") : t("calendar.pending")}
                    </Text>
                    <View style={styles.actions}>
                      <Pressable
                        style={[
                          styles.actionButton,
                          { backgroundColor: isPaid ? accentGreen : peachBg },
                        ]}
                        onPress={() => onBillPaymentToggle?.(occurrence)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={isPaid ? t("calendar.paid") : t("calendar.pending")}
                      >
                        <Check size={16} color={isPaid ? "#FFFFFF" : primaryColor} />
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, { backgroundColor: peachBg }]}
                        onPress={() => onBillEdit?.(bill)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.edit")}
                      >
                        <Pencil size={16} color={primaryColor} />
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, { backgroundColor: peachBg }]}
                        onPress={() => onBillDelete?.(bill)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.delete")}
                      >
                        <Trash2 size={16} color={accentRed} />
                      </Pressable>
                    </View>
                  </View>
                </GlassSurface>
              );
            })}
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
  billCard: {
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  billMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  billIcon: {
    fontSize: 20,
  },
  billCopy: {
    flex: 1,
  },
  billName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  paidText: {
    textDecorationLine: "line-through",
  },
  billMeta: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  billAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
