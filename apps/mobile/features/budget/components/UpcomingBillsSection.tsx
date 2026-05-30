import { useRouter } from "expo-router";
import { useMemo } from "react";
import { getNextOccurrence, useCalendarStore } from "@/features/calendar/public";
import { CATEGORY_MAP } from "@/shared/categories";
import { EmptyState } from "@/shared/components";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";

const MAX_UPCOMING_BILLS = 3;

export function UpcomingBillsSection() {
  const { t, locale } = useTranslation();
  const { push } = useRouter();
  const bills = useCalendarStore((s) => s.bills);
  const primaryColor = useThemeColor("primary");
  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");

  const upcomingBills = useMemo(() => {
    const now = new Date();
    return bills
      .reduce<Array<{ readonly bill: (typeof bills)[number]; readonly nextDate: Date }>>(
        (items, bill) => {
          if (bill.isActive) {
            items.push({ bill, nextDate: getNextOccurrence(bill, now) });
          }
          return items;
        },
        []
      )
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
      .slice(0, MAX_UPCOMING_BILLS);
  }, [bills]);

  const handleSeeAll = () => {
    push("/bills-calendar");
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
        <EmptyState
          title={t("budgets.upcomingBills.noBills")}
          className="min-h-16 flex-none px-4 py-4"
        />
      ) : (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
          {upcomingBills.map(({ bill, nextDate }, index) => {
            const category = CATEGORY_MAP[bill.categoryId] ?? null;
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
                  {category ? <Text style={{ color: category.color }}>{category.icon}</Text> : null}
                  <View>
                    <Text style={[styles.billName, { color: primaryColor }]}>{bill.name}</Text>
                    <Text className="font-poppins-medium text-[11px] text-text-secondary dark:text-text-secondary-dark">
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
                  {formatMoney(bill.amount)}
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
  billAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
});
