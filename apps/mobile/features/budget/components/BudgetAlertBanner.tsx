import { CATEGORY_MAP } from "@/features/transactions";
import { TriangleAlert, X } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import type { BudgetAlert } from "../lib/derive";

type Props = {
  readonly alert: BudgetAlert;
  readonly onDismiss: (budgetId: string, threshold: 80 | 100) => void;
};

export function BudgetAlertBanner({ alert, onDismiss }: Props) {
  const { t, locale } = useTranslation();
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");

  const category = CATEGORY_MAP[alert.categoryId];
  const categoryLabel = category ? getCategoryLabel(category, locale) : alert.categoryId;

  const isOverBudget = alert.threshold === 100;
  // Over budget: solid red. Near limit: soft pastel green (15% opacity)
  const backgroundColor = isOverBudget ? `${accentRed}20` : `${accentGreen}18`;
  const textColor = primaryColor;
  const iconColor = isOverBudget ? accentRed : accentGreen;

  const message = isOverBudget
    ? t("budgets.alerts.overBudget", { category: categoryLabel, percent: alert.percentUsed })
    : t("budgets.alerts.nearLimit", { category: categoryLabel, percent: alert.percentUsed });

  const handleDismiss = () => onDismiss(alert.budgetId, alert.threshold);

  return (
    <View style={[styles.banner, { backgroundColor, borderColor: iconColor, borderWidth: 1 }]}>
      <TriangleAlert size={18} color={iconColor} />
      <Text style={[styles.text, { color: textColor }]} numberOfLines={2}>
        {message}
      </Text>
      <Pressable onPress={handleDismiss} hitSlop={12}>
        <X size={18} color={textColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderCurve: "continuous",
    padding: 12,
  },
  text: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
});
