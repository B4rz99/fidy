import { memo } from "react";
import { Button } from "@/shared/components";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
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
  const peachLight = useThemeColor("peachLight");

  const { goal, currentAmount, progress, paceGuidance } = goalWithProgress;

  const progressWidth = Math.min(progress.percentComplete, 100);
  const remainingAmount = Math.max(goal.targetAmount - currentAmount, 0);
  const goalIcon = goal.iconName ?? (goal.type === "debt" ? "💳" : "🎯");
  const goalColor = goal.type === "debt" ? accentRed : (goal.colorHex ?? accentGreen);

  const cardStatus = deriveGoalCardStatus(progress, paceGuidance);

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.summaryArea} onPress={onPress}>
        <View style={styles.headerRow}>
          <View style={styles.titleGroup}>
            <View style={[styles.iconBadge, { backgroundColor: goalColor }]}>
              <Text style={styles.iconText}>{goalIcon}</Text>
            </View>
            <View style={styles.titleCopy}>
              <Text style={[styles.goalName, { color: primaryColor }]} numberOfLines={1}>
                {goal.name}
              </Text>
              <Text style={[styles.amountLine, { color: secondaryColor }]} numberOfLines={1}>
                {t("goals.card.amountOfTarget", {
                  current: formatMoney(currentAmount),
                  target: formatMoney(goal.targetAmount),
                })}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.percentPill,
              { backgroundColor: goal.type === "debt" ? peachLight : accentGreenLight },
            ]}
          >
            <Text style={[styles.percentText, { color: goalColor }]}>
              {Math.round(progress.percentComplete)}%
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.progressTrack,
            { backgroundColor: goal.type === "debt" ? peachLight : accentGreenLight },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: goalColor, width: `${progressWidth}%` },
            ]}
          />
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.remainingText, { color: secondaryColor }]} numberOfLines={1}>
            {t("goals.card.remaining", { amount: formatMoney(remainingAmount) })}
          </Text>
          <GoalCardStatus
            accentGreen={accentGreen}
            accentRed={accentRed}
            cardStatus={goal.type === "debt" ? null : cardStatus}
            secondaryColor={secondaryColor}
            t={t}
          />
          {goal.type === "debt" ? (
            <Text style={[styles.statusText, { color: accentRed }]}>{t("goals.card.debt")}</Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <Button
          label={t("goals.card.addPayment")}
          size="compact"
          className="h-10 flex-1 rounded-lg"
          onPress={onAddPayment}
        />
        <Button
          label={t("goals.card.detail")}
          variant="secondary"
          size="compact"
          className="h-10 flex-1 rounded-lg"
          onPress={onPress}
        />
      </View>
    </View>
  );
}

export const GoalCard = memo(GoalCardInner);

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 16,
    gap: 12,
  },
  summaryArea: {
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
  },
  titleCopy: {
    flex: 1,
  },
  goalName: {
    fontFamily: "Poppins_700Bold",
    fontSize: 15,
  },
  amountLine: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  percentPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  percentText: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  footerRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  remainingText: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  statusText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
});
