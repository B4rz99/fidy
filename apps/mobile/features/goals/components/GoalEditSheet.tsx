import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { useAuthStore } from "@/features/auth";
import { handleNumpadPress } from "@/features/transactions";
import { FidyNumpad } from "@/shared/components";
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useBlinkingCursor, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, parseDigitsToAmount, parseIsoDate, toIsoDate } from "@/shared/lib";
import type { IsoDate, UserId } from "@/shared/types/branded";
import { deleteGoal, updateGoal, useGoalStore } from "../store";

export function GoalEditSheet() {
  const { back } = useRouter();
  const { t, locale } = useTranslation();

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const goals = useGoalStore((s) => s.goals);
  const userId = useAuthStore((s) => s.session?.user.id ?? null) as UserId | null;

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
  const [interestRate, setInterestRate] = useState(
    goal?.interestRatePercent != null ? String(goal.interestRatePercent) : ""
  );
  const [numpadTarget, setNumpadTarget] = useState<"amount" | null>(null);
  const [targetDate, setTargetDate] = useState<Date | null>(
    goal?.targetDate ? parseIsoDate(goal.targetDate as IsoDate) : null
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Blinking cursor
  const { cursorStyle } = useBlinkingCursor();

  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();
  const { isBusy: isDeleting, run: guardedDelete } = useAsyncGuard();

  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : "$";

  const handleKey = useCallback(
    (key: string) => {
      if (numpadTarget === "amount") {
        setDigits(handleNumpadPress(digitsRef.current, key));
      }
    },
    [numpadTarget]
  );

  const handleSave = useCallback(
    () =>
      guardedSave(async () => {
        if (selectedGoalId == null || !userId) return;
        const db = tryGetDb(userId);
        if (!db) return;
        const parsedAmount = parseDigitsToAmount(digits);
        if (!name.trim() || parsedAmount <= 0) return;

        const normalizedRate = interestRate.replace(",", ".");
        const isValidRate = /^\d+(\.\d+)?$/.test(normalizedRate);
        const parsedRate = isValidRate ? Number.parseFloat(normalizedRate) : null;
        const success = await updateGoal(db, userId, selectedGoalId, {
          name: name.trim(),
          targetAmount: parsedAmount,
          targetDate: targetDate ? toIsoDate(targetDate) : null,
          interestRatePercent:
            goalType === "debt" && parsedRate != null && Number.isFinite(parsedRate)
              ? parsedRate
              : null,
        });
        if (success) back();
      }),
    [selectedGoalId, name, digits, goalType, targetDate, interestRate, back, guardedSave, userId]
  );

  const handleDelete = useCallback(() => {
    if (selectedGoalId == null || goal == null || !userId) return;
    Alert.alert(
      t("goals.edit.deleteConfirmTitle"),
      t("goals.edit.deleteConfirmMessage", { goalName: goal.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            void guardedDelete(async () => {
              const db = tryGetDb(userId);
              if (!db) return;
              const success = await deleteGoal(db, userId, selectedGoalId);
              if (success) back();
            });
          },
        },
      ]
    );
  }, [selectedGoalId, goal, back, guardedDelete, t, userId]);

  const handleDateChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (date) setTargetDate(date);
  }, []);

  if (goal == null) return null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Grab bar */}
      <View style={[styles.grabBar, { backgroundColor: borderColor }]} />

      <Text style={[styles.title, { color: primaryColor }]}>{t("goals.edit.title")}</Text>

      {/* 1. Target amount (FIRST) */}
      <Pressable
        style={styles.amountSection}
        onPress={() => {
          Keyboard.dismiss();
          setShowDatePicker(false);
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
              style={[styles.cursor, { backgroundColor: primaryColor }, cursorStyle]}
            />
          ) : null}
        </View>
      </Pressable>

      {/* 2. Interest rate — debt only (SECOND) */}
      {goalType === "debt" ? (
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: primaryColor }]}>
            {t("goals.create.interestRate")}
          </Text>
          <View style={styles.interestInputRow}>
            <TextInput
              style={[
                styles.input,
                styles.interestInput,
                { backgroundColor: cardBg, borderColor, color: primaryColor },
              ]}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={tertiaryColor}
              value={interestRate}
              onChangeText={setInterestRate}
              onFocus={() => {
                setNumpadTarget(null);
                setShowDatePicker(false);
              }}
            />
            <Text style={[styles.interestSuffix, { color: primaryColor }]}>%</Text>
          </View>
        </View>
      ) : null}

      {/* 3. Goal name (THIRD) */}
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
          onFocus={() => {
            setNumpadTarget(null);
            setShowDatePicker(false);
          }}
        />
      </View>

      {/* 4. Target date — native picker (FOURTH) */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>
          {t("goals.create.targetDate")}
        </Text>
        <Pressable
          style={[styles.input, styles.dateButton, { backgroundColor: cardBg, borderColor }]}
          onPress={() => {
            Keyboard.dismiss();
            setNumpadTarget(null);
            setShowDatePicker(true);
          }}
        >
          <Text style={[styles.dateText, { color: targetDate ? primaryColor : tertiaryColor }]}>
            {targetDate
              ? targetDate.toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : t("goals.create.targetDate")}
          </Text>
          {targetDate != null ? (
            <Pressable
              onPress={() => {
                setTargetDate(null);
                setShowDatePicker(false);
              }}
              hitSlop={8}
            >
              <Text style={{ color: accentRed, fontSize: 14 }}>✕</Text>
            </Pressable>
          ) : null}
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker
            value={targetDate ?? new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            minimumDate={new Date()}
            onChange={handleDateChange}
            accentColor={accentGreen}
          />
        ) : null}
      </View>

      {/* Save button */}
      <Pressable
        style={[styles.saveButton, { backgroundColor: accentGreen, opacity: isSaving ? 0.5 : 1 }]}
        onPress={() => {
          void handleSave();
        }}
        disabled={isSaving || userId == null}
      >
        <Text style={styles.saveButtonText}>{t("goals.edit.saveChanges")}</Text>
      </Pressable>

      {/* Delete button */}
      <Pressable
        style={[styles.deleteButton, { borderColor: accentRed, opacity: isDeleting ? 0.5 : 1 }]}
        onPress={handleDelete}
        disabled={isDeleting || userId == null}
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
  grabBar: { width: 36, height: 5, borderRadius: 3, alignSelf: "center" },
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
  dateButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateText: { fontFamily: "Poppins_500Medium", fontSize: 14 },
  amountSection: { alignItems: "center", gap: 4, paddingVertical: 8 },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  amountDisplay: { fontFamily: "Poppins_700Bold", fontSize: 32 },
  interestInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  interestInput: { flex: 1 },
  interestSuffix: { fontFamily: "Poppins_700Bold", fontSize: 18 },
  cursor: { width: 2, height: 28, marginLeft: 2, borderRadius: 1 },
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
