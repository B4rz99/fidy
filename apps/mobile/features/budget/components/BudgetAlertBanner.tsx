import { CATEGORY_MAP } from "@/shared/categories";
import { IconActionButton } from "@/shared/components/IconActionButton";
import { X } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { formatMoney, trackBudgetAlertViewed } from "@/shared/lib";
import type { BudgetId } from "@/shared/types/branded";
import type { BudgetAlert } from "../lib/derive";

type Props = {
  readonly alert: BudgetAlert;
  readonly onDismiss: (budgetId: BudgetId, threshold: 80 | 100) => void;
};

export function BudgetAlertBanner({ alert, onDismiss }: Props) {
  const { t, locale } = useTranslation();
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");

  useMountEffect(() =>
    trackBudgetAlertViewed({ threshold: alert.threshold, category: String(alert.categoryId) })
  );

  const category = CATEGORY_MAP[alert.categoryId];
  const CategoryIcon = category?.icon;
  const categoryLabel = category ? getCategoryLabel(category, locale) : alert.categoryId;

  const isOverBudget = alert.threshold === 100;
  const bannerBg = isOverBudget ? `${accentRed}1E` : `${accentGreen}1E`;
  const circleBg = isOverBudget ? `${accentRed}40` : `${accentGreen}40`;
  const iconColor = isOverBudget ? accentRed : accentGreen;

  const title = isOverBudget
    ? t("budgets.alerts.overBudget", { category: categoryLabel, percent: alert.percentUsed })
    : t("budgets.alerts.nearLimit", { category: categoryLabel, percent: alert.percentUsed });

  const remaining = formatMoney(Math.abs(alert.remainingAmount));
  const overAmount = remaining;

  const handleDismiss = () => onDismiss(alert.budgetId, alert.threshold);

  return (
    <View style={[styles.banner, { backgroundColor: bannerBg }]}>
      <View style={[styles.iconCircle, { backgroundColor: circleBg }]}>
        {CategoryIcon ? <Text style={{ color: iconColor }}>{CategoryIcon}</Text> : null}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: primaryColor }]}>{title}</Text>
        {alert.suggestionKey !== undefined && (
          <Text style={[styles.suggestion, { color: secondaryColor }]}>
            {t(alert.suggestionKey, { remaining, daysLeft: alert.daysLeft, overAmount })}
          </Text>
        )}
      </View>
      <IconActionButton
        accessibilityLabel={t("common.dismiss")}
        className="size-8"
        icon={<X size={16} color={secondaryColor} />}
        onPress={handleDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  suggestion: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});
