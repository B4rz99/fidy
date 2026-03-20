import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { useGoalStore } from "../store";

export function GoalEditSheet() {
  const { back } = useRouter();
  const { t } = useTranslation();

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const goals = useGoalStore((s) => s.goals);
  const updateGoal = useGoalStore((s) => s.updateGoal);
  const deleteGoal = useGoalStore((s) => s.deleteGoal);

  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const _secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const accentRed = useThemeColor("accentRed");

  // Find the selected goal to pre-fill
  const goalData = goals.find((g) => g.goal.id === selectedGoalId);
  const goal = goalData?.goal;

  const goalType = goal?.type ?? "savings";
  const [name, setName] = useState(goal?.name ?? "");
  const [amountText, setAmountText] = useState(
    goal?.targetAmount != null ? String(goal.targetAmount) : ""
  );
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [interestRate, setInterestRate] = useState(
    goal?.interestRatePercent != null ? String(goal.interestRatePercent) : ""
  );

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const { isBusy: isDeleting, run: guardedDelete } = useAsyncGuard();

  const handleSave = useCallback(
    () =>
      guardedSave(async () => {
        if (selectedGoalId == null) return;

        const parsedAmount = Number.parseInt(amountText.replace(/\D/g, ""), 10);
        if (!name.trim() || !parsedAmount || parsedAmount <= 0) return;

        await updateGoal(selectedGoalId, {
          name: name.trim(),
          targetAmount: parsedAmount,
          targetDate: targetDate || null,
          interestRatePercent:
            goalType === "debt" && interestRate
              ? (Number.isFinite(Number.parseFloat(interestRate)) ? Number.parseFloat(interestRate) : null)
              : null,
        });

        back();
      }),
    [
      selectedGoalId,
      name,
      amountText,
      goalType,
      targetDate,
      interestRate,
      updateGoal,
      back,
      guardedSave,
    ]
  );

  const handleDelete = useCallback(() => {
    if (selectedGoalId == null || goal == null) return;

    Alert.alert(
      t("goals.edit.deleteConfirmTitle"),
      t("goals.edit.deleteConfirmMessage", { goalName: goal.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () =>
            guardedDelete(async () => {
              await deleteGoal(selectedGoalId);
              back();
            }),
        },
      ]
    );
  }, [selectedGoalId, goal, deleteGoal, back, guardedDelete, t]);

  if (goal == null) {
    return null;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text style={[styles.title, { color: primaryColor }]}>{t("goals.edit.title")}</Text>

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

      {/* Save changes button */}
      <Pressable
        style={[styles.saveButton, { backgroundColor: accentGreen, opacity: isSaving ? 0.5 : 1 }]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>{t("goals.edit.saveChanges")}</Text>
      </Pressable>

      {/* Delete goal button */}
      <Pressable
        style={[styles.deleteButton, { borderColor: accentRed, opacity: isDeleting ? 0.5 : 1 }]}
        onPress={handleDelete}
        disabled={isDeleting}
      >
        <Text style={[styles.deleteButtonText, { color: accentRed }]}>
          {t("goals.edit.deleteGoal")}
        </Text>
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
  saveButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  saveButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  deleteButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  deleteButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
  },
});
