import { memo } from "react";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import { deriveGoalCardStatus } from "../lib/derive";
import type { GoalWithProgress } from "../types";

type GoalCardProps = {
  readonly goalWithProgress: GoalWithProgress;
  readonly onPress: () => void;
  readonly onAddPayment: () => void;
};

function GoalCardInner({ goalWithProgress, onPress, onAddPayment }: GoalCardProps) {
  const { t } = useTranslation();
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");

  const { goal, currentAmount, progress, installments, paceGuidance } = goalWithProgress;

  const progressWidth = Math.min(progress.percentComplete, 100);

  const cardStatus = deriveGoalCardStatus(progress, paceGuidance);

  const renderStatus = () => {
    if (cardStatus === null) return null;
    if (cardStatus.kind === "completed" || cardStatus.kind === "almost_there") {
      const label =
        cardStatus.kind === "completed" ? t("goals.card.completed") : t("goals.card.almostThere");
      return (
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: accentGreen }}>
          {label}
        </Text>
      );
    }
    // Pace chip variants
    const chipColor =
      cardStatus.kind === "pace_ahead"
        ? accentGreen
        : cardStatus.kind === "pace_behind"
          ? accentRed
          : secondaryColor;
    const chipLabel =
      cardStatus.kind === "pace_ahead"
        ? t("goals.card.paceAhead", { amount: formatMoney(cardStatus.amount) })
        : cardStatus.kind === "pace_behind"
          ? t("goals.card.paceBehind", { amount: formatMoney(cardStatus.amount) })
          : t("goals.card.startSaving");
    return (
      <View
        style={{
          paddingVertical: 3,
          paddingHorizontal: 8,
          borderRadius: 8,
          backgroundColor: `${chipColor}26`,
        }}
      >
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 11, color: chipColor }}>
          {chipLabel}
        </Text>
      </View>
    );
  };

  return (
    <Pressable
      style={{
        backgroundColor: cardBg,
        borderColor,
        borderWidth: 1,
        borderRadius: 16,
        borderCurve: "continuous",
        padding: 16,
        gap: 12,
      }}
      onPress={onPress}
    >
      {/* Header row: name + target */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text
          style={{ flex: 1, fontFamily: "Poppins_600SemiBold", fontSize: 15, color: primaryColor }}
          numberOfLines={1}
        >
          {goal.name}
        </Text>
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 13, color: accentGreen }}>
          {formatMoney(goal.targetAmount as CopAmount)}
        </Text>
      </View>

      {/* Progress info row */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: secondaryColor }}>
          {installments.total > 0
            ? t("goals.card.installments", {
                current: String(installments.current),
                total: String(installments.total),
              })
            : ""}
        </Text>
        {renderStatus()}
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 24,
          borderRadius: 12,
          backgroundColor: accentGreenLight,
          overflow: "hidden",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            borderRadius: 12,
            backgroundColor: accentGreen,
            width: `${progressWidth}%`,
          }}
        />
        <Text
          style={{
            paddingLeft: 10,
            fontFamily: "Poppins_500Medium",
            fontSize: 11,
            color: primaryColor,
          }}
          numberOfLines={1}
        >
          {formatMoney(currentAmount as CopAmount)}
        </Text>
      </View>

      {/* Add payment button */}
      <Pressable
        style={{
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: accentGreen,
        }}
        onPress={onAddPayment}
      >
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#FFFFFF" }}>
          {t("goals.card.addPayment")}
        </Text>
      </Pressable>
    </Pressable>
  );
}

export const GoalCard = memo(GoalCardInner);
