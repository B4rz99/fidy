import { memo } from "react";
import { CATEGORY_MAP } from "@/shared/categories";
import { Card, Surface, ProgressBar } from "@/shared/components";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { deriveBudgetPulseCardModel, type BudgetProgress } from "../lib/derive";

type Props = {
  readonly progress: BudgetProgress;
  readonly onPress: (budgetId: string) => void;
};

function BudgetCardInner({ progress, onPress }: Props) {
  const { t, locale } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  const category = CATEGORY_MAP[progress.categoryId] ?? null;
  const CategoryIcon = category?.icon;
  const categoryLabel = category ? getCategoryLabel(category, locale) : progress.categoryId;
  const model = deriveBudgetPulseCardModel({ progress, t });
  const badgeColor = model.tone === "danger" ? accentRed : accentGreen;
  const progressColor = model.tone === "danger" ? accentRed : accentGreen;

  const handlePress = () => onPress(progress.budgetId);

  return (
    <Card contentClassName="gap-3 p-3.5" onPress={handlePress}>
      <View style={styles.header}>
        <View style={styles.categoryRow}>
          {category && CategoryIcon ? (
            <Surface radius={8} padded={false} style={styles.emojiBubble}>
              <Text style={styles.emoji}>{CategoryIcon}</Text>
            </Surface>
          ) : null}
          <View style={styles.categoryText}>
            <Text style={[styles.categoryName, { color: primaryColor }]}>{categoryLabel}</Text>
            <Text style={[styles.amountLine, { color: secondaryColor }]}>{model.amountLine}</Text>
          </View>
        </View>
        <Surface radius={999} padded={false} style={styles.badge}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{model.percentLabel}</Text>
        </Surface>
      </View>

      <ProgressBar
        percent={progress.percentUsed}
        height={7}
        fillColor={progressColor}
        completeTone={model.tone === "danger" ? "danger" : "success"}
      />

      <View style={styles.footer}>
        <Text style={[styles.spentText, { color: secondaryColor }]}>{model.remainingLabel}</Text>
        <Text
          style={[
            styles.remainingText,
            { color: model.tone === "danger" ? accentRed : primaryColor },
          ]}
        >
          {model.statusLabel}
        </Text>
      </View>
    </Card>
  );
}

export const BudgetCard = memo(BudgetCardInner);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  emojiBubble: {
    alignItems: "center",
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  emoji: {
    fontSize: 18,
  },
  categoryText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  categoryName: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  amountLine: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
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
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
  },
});
