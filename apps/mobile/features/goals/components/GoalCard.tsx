import { memo } from "react";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { deriveGoalCardStatus } from "../lib/derive";
import type { GoalWithProgress } from "../types";

type GoalCardProps = {
  readonly goalWithProgress: GoalWithProgress;
  readonly onPress: () => void;
  readonly onAddPayment: () => void;
};

type GoalCardStatusValue = NonNullable<ReturnType<typeof deriveGoalCardStatus>>;

function GoalCardStatus(props: {
  readonly accentGreen: string;
  readonly accentRed: string;
  readonly cardStatus: GoalCardStatusValue | null;
  readonly secondaryColor: string;
  readonly t: ReturnType<typeof useTranslation>["t"];
}) {
  if (props.cardStatus === null) return null;
  if (props.cardStatus.kind === "completed" || props.cardStatus.kind === "almost_there") {
    const label =
      props.cardStatus.kind === "completed"
        ? props.t("goals.card.completed")
        : props.t("goals.card.almostThere");
    return (
      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: props.accentGreen }}>
        {label}
      </Text>
    );
  }

  const chip = (() => {
    if (props.cardStatus.kind === "pace_ahead") {
      return {
        color: props.accentGreen,
        label: props.t("goals.card.paceAhead", { amount: formatMoney(props.cardStatus.amount) }),
      };
    }

    if (props.cardStatus.kind === "pace_behind") {
      return {
        color: props.accentRed,
        label: props.t("goals.card.paceBehind", { amount: formatMoney(props.cardStatus.amount) }),
      };
    }

    return { color: props.secondaryColor, label: props.t("goals.card.startSaving") };
  })();

  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: `${chip.color}26`,
      }}
    >
      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: chip.color }}>
        {chip.label}
      </Text>
    </View>
  );
}

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
          {formatMoney(goal.targetAmount)}
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
        <GoalCardStatus
          accentGreen={accentGreen}
          accentRed={accentRed}
          cardStatus={cardStatus}
          secondaryColor={secondaryColor}
          t={t}
        />
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
            fontSize: 12,
            color: primaryColor,
          }}
          numberOfLines={1}
        >
          {formatMoney(currentAmount)}
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
