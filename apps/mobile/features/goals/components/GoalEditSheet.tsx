import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { handleNumpadPress } from "@/features/transactions";
import { FidyNumpad } from "@/shared/components";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, parseDigitsToAmount } from "@/shared/lib";
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
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");
  const accentRed = useThemeColor("accentRed");

  const goalData = goals.find((g) => g.goal.id === selectedGoalId);
  const goal = goalData?.goal;

  const goalType = goal?.type ?? "savings";
  const [name, setName] = useState(goal?.name ?? "");
  const [digits, setDigits] = useState(goal?.targetAmount != null ? String(goal.targetAmount) : "");
  const digitsRef = useRef(digits);
  digitsRef.current = digits;
  const [interestDigits, setInterestDigits] = useState(
    goal?.interestRatePercent != null ? String(goal.interestRatePercent) : ""
  );
  const interestDigitsRef = useRef(interestDigits);
  interestDigitsRef.current = interestDigits;
  const [numpadTarget, setNumpadTarget] = useState<"amount" | "interestRate" | null>(null);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");

  // Blinking cursor
  const cursorOpacity = useSharedValue(1);
  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(1, { duration: 530 }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: 530 })
      ),
      -1
    );
  }, [cursorOpacity]);
  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOpacity.value }));

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const { isBusy: isDeleting, run: guardedDelete } = useAsyncGuard();

  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : "$";

  const handleKey = useCallback(
    (key: string) => {
      if (numpadTarget === "amount") {
        setDigits(handleNumpadPress(digitsRef.current, key));
      } else if (numpadTarget === "interestRate") {
        setInterestDigits(handleNumpadPress(interestDigitsRef.current, key));
      }
    },
    [numpadTarget]
  );

  const handleSave = useCallback(
    () =>
      guardedSave(async () => {
        if (selectedGoalId == null) return;
        const parsedAmount = parseDigitsToAmount(digits);
        if (!name.trim() || parsedAmount <= 0) return;

        await updateGoal(selectedGoalId, {
          name: name.trim(),
          targetAmount: parsedAmount,
          targetDate: targetDate || null,
          interestRatePercent:
            goalType === "debt" && interestDigits ? parseDigitsToAmount(interestDigits) : null,
        });
        back();
      }),
    [
      selectedGoalId,
      name,
      digits,
      goalType,
      targetDate,
      interestDigits,
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

  if (goal == null) return null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
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
          onFocus={() => setNumpadTarget(null)}
        />
      </View>

      {/* Target amount — FidyNumpad display */}
      <Pressable
        style={styles.amountSection}
        onPress={() => {
          Keyboard.dismiss();
          setNumpadTarget("amount");
        }}
      >
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>
          {t("goals.create.targetAmount")}
        </Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amountDisplay, { color: primaryColor }]}>{displayAmount}</Text>
          {numpadTarget === "amount" ? (
            <Animated.View
              style={[
                {
                  width: 2,
                  height: 28,
                  marginLeft: 2,
                  borderRadius: 1,
                  backgroundColor: primaryColor,
                },
                cursorStyle,
              ]}
            />
          ) : null}
        </View>
      </Pressable>

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
          onFocus={() => setNumpadTarget(null)}
        />
      </View>

      {/* Interest rate (debt only) */}
      {goalType === "debt" ? (
        <Pressable
          style={styles.amountSection}
          onPress={() => {
            Keyboard.dismiss();
            setNumpadTarget("interestRate");
          }}
        >
          <Text style={[styles.fieldLabel, { color: primaryColor }]}>
            {t("goals.create.interestRate")}
          </Text>
          <View style={styles.amountRow}>
            {interestDigits.length > 0 ? (
              <Text style={[styles.amountDisplay, { color: primaryColor, fontSize: 24 }]}>
                {interestDigits}
              </Text>
            ) : null}
            {numpadTarget === "interestRate" ? (
              <Animated.View
                style={[
                  {
                    width: 2,
                    height: 22,
                    marginLeft: 2,
                    marginRight: 2,
                    borderRadius: 1,
                    backgroundColor: primaryColor,
                  },
                  cursorStyle,
                ]}
              />
            ) : null}
            {interestDigits.length > 0 ? (
              <Text style={[styles.amountDisplay, { color: tertiaryColor, fontSize: 24 }]}>%</Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {/* Save button */}
      <Pressable
        style={[styles.saveButton, { backgroundColor: accentGreen, opacity: isSaving ? 0.5 : 1 }]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>{t("goals.edit.saveChanges")}</Text>
      </Pressable>

      {/* Delete button */}
      <Pressable
        style={[styles.deleteButton, { borderColor: accentRed, opacity: isDeleting ? 0.5 : 1 }]}
        onPress={handleDelete}
        disabled={isDeleting}
      >
        <Text style={[styles.deleteButtonText, { color: accentRed }]}>
          {t("goals.edit.deleteGoal")}
        </Text>
      </Pressable>

      {numpadTarget != null ? <FidyNumpad onKeyPress={handleKey} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, gap: 16 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 18, textAlign: "center" },
  fieldGroup: { gap: 4 },
  fieldLabel: { fontFamily: "Poppins_500Medium", fontSize: 12, fontStyle: "italic" },
  input: {
    height: 48,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  amountSection: { alignItems: "center", gap: 4, paddingVertical: 8 },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  amountDisplay: { fontFamily: "Poppins_700Bold", fontSize: 32 },
  saveButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  saveButtonText: { fontFamily: "Poppins_700Bold", fontSize: 16, color: "#FFFFFF" },
  deleteButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  deleteButtonText: { fontFamily: "Poppins_700Bold", fontSize: 16 },
});
