import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useCalendarStore } from "@/features/calendar";
import { getNextOccurrence } from "@/features/calendar/lib/calendar-utils";
import { CATEGORY_MAP, formatCents } from "@/features/transactions";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";

const MAX_UPCOMING_BILLS = 3;

export function UpcomingBillsSection() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const bills = useCalendarStore((s) => s.bills);
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");

  const upcomingBills = useMemo(() => {
    const now = new Date();
    return bills
      .filter((b) => b.isActive)
      .map((bill) => ({
        bill,
        nextDate: getNextOccurrence(bill, now),
      }))
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
      .slice(0, MAX_UPCOMING_BILLS);
  }, [bills]);

  const handleSeeAll = () => {
    router.push("/bills-calendar");
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("budgets.upcomingBills.title")}
        </Text>
        <Pressable onPress={handleSeeAll}>
          <Text style={[styles.seeAll, { color: accentGreen }]}>
            {t("budgets.upcomingBills.seeAll")}
          </Text>
        </Pressable>
      </View>

      {upcomingBills.length === 0 ? (
        <Text style={[styles.emptyText, { color: secondaryColor }]}>
          {t("budgets.upcomingBills.noBills")}
        </Text>
      ) : (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {upcomingBills.map(({ bill, nextDate }, index) => {
            const category = CATEGORY_MAP[bill.categoryId];
            const CategoryIcon = category?.icon;
            const categoryLabel = category ? getCategoryLabel(category, locale) : bill.categoryId;

            return (
              <View
                key={bill.id}
                style={[
                  styles.billRow,
                  index < upcomingBills.length - 1 && { borderBottomWidth: 1, borderColor },
                ]}
              >
                <View style={styles.billInfo}>
                  {CategoryIcon && (
                    <CategoryIcon size={16} color={category?.color ?? primaryColor} />
                  )}
                  <View>
                    <Text style={[styles.billName, { color: primaryColor }]}>{bill.name}</Text>
                    <Text style={[styles.billDate, { color: secondaryColor }]}>
                      {nextDate.toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                      {" \u00B7 "}
                      {categoryLabel}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.billAmount, { color: primaryColor }]}>
                  {formatCents(bill.amountCents)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  seeAll: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  emptyText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 16,
  },
  card: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    overflow: "hidden",
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  billInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  billName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  billDate: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  billAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
});
