import { memo } from "react";
import { CATEGORY_MAP } from "@/features/transactions";
import { ProgressBar } from "@/shared/components";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import type { BudgetProgress } from "../lib/derive";

type Props = {
  readonly progress: BudgetProgress;
  readonly onPress: (budgetId: string) => void;
};

function BudgetCardInner({ progress, onPress }: Props) {
  const { t, locale } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const cardBg = useThemeColor("card");
  const borderColor = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  const category = CATEGORY_MAP[progress.categoryId] ?? null;
  const CategoryIcon = category?.icon;
  const categoryLabel = category ? getCategoryLabel(category, locale) : progress.categoryId;
  const badgeColor = progress.isOverBudget ? accentRed : accentGreen;

  const remainingText = progress.isOverBudget
    ? t("budgets.card.over", { amount: formatMoney(Math.abs(progress.remaining) as CopAmount) })
    : t("budgets.card.remaining", { amount: formatMoney(progress.remaining) });

  const handlePress = () => onPress(progress.budgetId);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: cardBg, borderColor }]}
      onPress={handlePress}
    >
      <View style={styles.header}>
        <View style={styles.categoryRow}>
          {category && CategoryIcon && <CategoryIcon size={18} color={category.color} />}
          <Text style={[styles.categoryName, { color: primaryColor }]}>{categoryLabel}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>
            {t("budgets.card.used", { percent: progress.percentUsed })}
          </Text>
        </View>
      </View>

      <ProgressBar percent={progress.percentUsed} />

      <View style={styles.footer}>
        <Text style={[styles.spentText, { color: secondaryColor }]}>
          {formatMoney(progress.spent)} / {formatMoney(progress.amount)}
        </Text>
        <Text
          style={[
            styles.remainingText,
            { color: progress.isOverBudget ? accentRed : secondaryColor },
          ]}
        >
          {remainingText}
        </Text>
      </View>
    </Pressable>
  );
}

export const BudgetCard = memo(BudgetCardInner);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    color: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spentText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  remainingText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});
