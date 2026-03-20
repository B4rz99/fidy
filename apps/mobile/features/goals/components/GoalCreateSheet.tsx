import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import type { GoalType } from "../schema";
import { useGoalStore } from "../store";

export function GoalCreateSheet() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const createGoal = useGoalStore((s) => s.createGoal);
  const goals = useGoalStore((s) => s.goals);

  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const [goalType, setGoalType] = useState<GoalType>("savings");
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [interestRate, setInterestRate] = useState("");

  const { isBusy: isCreating, run: guardedCreate } = useAsyncGuard();

  // Derive projection hint from store's existing projection data
  const projectionMonths = goals.length > 0 ? goals[0].projection.netMonthlySavings : 0;
  const amount = Number.parseInt(amountText.replace(/\D/g, ""), 10) || 0;
  const estimatedMonths =
    projectionMonths > 0 && amount > 0 ? Math.ceil(amount / projectionMonths) : null;

  const handleCreate = useCallback(
    () =>
      guardedCreate(async () => {
        const parsedAmount = Number.parseInt(amountText.replace(/\D/g, ""), 10);
        if (!name.trim() || !parsedAmount || parsedAmount <= 0) return;

        const success = await createGoal({
          name: name.trim(),
          type: goalType,
          targetAmount: parsedAmount,
          targetDate: targetDate.trim() || undefined,
          interestRatePercent:
            goalType === "debt" && interestRate ? Number.parseFloat(interestRate) : undefined,
        });

        if (success) {
          back();
        }
      }),
    [name, amountText, goalType, targetDate, interestRate, createGoal, back, guardedCreate]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text style={[styles.title, { color: primaryColor }]}>{t("goals.create.title")}</Text>

      {/* Type toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[
            styles.toggleButton,
            goalType === "savings"
              ? { backgroundColor: accentGreen }
              : { backgroundColor: cardBg, borderColor, borderWidth: 1 },
          ]}
          onPress={() => setGoalType("savings")}
        >
          <Text
            style={[
              styles.toggleText,
              { color: goalType === "savings" ? "#FFFFFF" : secondaryColor },
            ]}
          >
            {t("goals.create.typeSavings")}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            goalType === "debt"
              ? { backgroundColor: accentGreen }
              : { backgroundColor: cardBg, borderColor, borderWidth: 1 },
          ]}
          onPress={() => setGoalType("debt")}
        >
          <Text
            style={[styles.toggleText, { color: goalType === "debt" ? "#FFFFFF" : secondaryColor }]}
          >
            {t("goals.create.typeDebt")}
          </Text>
        </Pressable>
      </View>

      {/* Goal name */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>
          {t("goals.create.goalName")}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, borderColor, color: primaryColor }]}
          placeholder={t("goals.create.goalNamePlaceholder")}
          placeholderTextColor={tertiaryColor}
          value={name}
          onChangeText={setName}
        />
      </View>

      {/* Target amount */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>
          {t("goals.create.targetAmount")}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, borderColor, color: primaryColor }]}
          placeholder="COP $0"
          placeholderTextColor={tertiaryColor}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="numeric"
        />
      </View>

      {/* Target date */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>
          {t("goals.create.targetDate")}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, borderColor, color: primaryColor }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tertiaryColor}
          value={targetDate}
          onChangeText={setTargetDate}
        />
      </View>

      {/* Interest rate (debt only) */}
      {goalType === "debt" ? (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: primaryColor }]}>
            {t("goals.create.interestRate")}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: cardBg, borderColor, color: primaryColor }]}
            placeholder="0"
            placeholderTextColor={tertiaryColor}
            value={interestRate}
            onChangeText={setInterestRate}
            keyboardType="numeric"
          />
        </View>
      ) : null}

      {/* Projection hint */}
      <Text style={[styles.projectionHint, { color: secondaryColor }]}>
        {estimatedMonths != null
          ? t("goals.create.projectionHint", { months: String(estimatedMonths) })
          : t("goals.create.noProjectionHint")}
      </Text>

      {/* Create button */}
      <Pressable
        style={[
          styles.createButton,
          { backgroundColor: accentGreen, opacity: isCreating ? 0.5 : 1 },
        ]}
        onPress={handleCreate}
        disabled={isCreating}
      >
        <Text style={styles.createButtonText}>{t("goals.create.title")}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    fontStyle: "italic",
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  projectionHint: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    textAlign: "center",
  },
  createButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  createButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
