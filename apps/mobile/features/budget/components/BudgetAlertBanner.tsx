import { CATEGORY_MAP } from "@/shared/categories";
import { Callout, Surface } from "@/shared/components";
import { Text } from "@/shared/components/rn";
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

  useMountEffect(() =>
    trackBudgetAlertViewed({ threshold: alert.threshold, category: String(alert.categoryId) })
  );

  const category = CATEGORY_MAP[alert.categoryId];
  const CategoryIcon = category?.icon;
  const categoryLabel = category ? getCategoryLabel(category, locale) : alert.categoryId;

  const isOverBudget = alert.threshold === 100;
  const iconColor = isOverBudget ? accentRed : accentGreen;

  const title = isOverBudget
    ? t("budgets.alerts.overBudget", { category: categoryLabel, percent: alert.percentUsed })
    : t("budgets.alerts.nearLimit", { category: categoryLabel, percent: alert.percentUsed });

  const remaining = formatMoney(Math.abs(alert.remainingAmount));
  const overAmount = remaining;

  const handleDismiss = () => onDismiss(alert.budgetId, alert.threshold);

  return (
    <Callout
      title={title}
      subtitle={
        alert.suggestionKey !== undefined
          ? t(alert.suggestionKey, { remaining, daysLeft: alert.daysLeft, overAmount })
          : undefined
      }
      icon={
        <Surface
          radius={16}
          padded={false}
          className="size-8 items-center justify-center rounded-full"
          style={{
            alignItems: "center",
            height: 32,
            justifyContent: "center",
            width: 32,
          }}
        >
          {CategoryIcon ? <Text style={{ color: iconColor }}>{CategoryIcon}</Text> : null}
        </Surface>
      }
      onDismiss={handleDismiss}
      dismissAccessibilityLabel={t("common.dismiss")}
      tone={isOverBudget ? "danger" : "warning"}
    />
  );
}
