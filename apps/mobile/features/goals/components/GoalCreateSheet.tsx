import DateTimePicker from "@react-native-community/datetimepicker";
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
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, parseDigitsToAmount, toIsoDate } from "@/shared/lib";
import type { GoalType } from "../schema";
import { useGoalStore } from "../store";

export function GoalCreateSheet() {
  const { back } = useRouter();
  const { t, locale } = useTranslation();
  const createGoal = useGoalStore((s) => s.createGoal);
  const goals = useGoalStore((s) => s.goals);

  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");

  const [goalType, setGoalType] = useState<GoalType>("savings");
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const digitsRef = useRef(digits);
  digitsRef.current = digits;
  const [interestRate, setInterestRate] = useState("");
  const [numpadTarget, setNumpadTarget] = useState<"amount" | null>("amount");
  const [targetDate, setTargetDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const { isBusy: isCreating, run: guardedCreate } = useAsyncGuard();

  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : "$";
  const amount = parseDigitsToAmount(digits);

  // Derive projection hint
  const projectionMonths = goals.length > 0 ? goals[0].projection.netMonthlySavings : 0;
  const estimatedMonths =
    projectionMonths > 0 && amount > 0 ? Math.ceil(amount / projectionMonths) : null;

  const handleKey = useCallback(
    (key: string) => {
      if (numpadTarget === "amount") {
        setDigits(handleNumpadPress(digitsRef.current, key));
      }
    },
    [numpadTarget]
  );

  const handleCreate = useCallback(
    () =>
      guardedCreate(async () => {
        const parsedAmount = parseDigitsToAmount(digits);
        if (!name.trim() || parsedAmount <= 0) return;

        const normalizedRate = interestRate.replace(",", ".");
        const isValidRate = /^\d+(\.\d+)?$/.test(normalizedRate);
        const parsedRate = isValidRate ? Number.parseFloat(normalizedRate) : undefined;
        const success = await createGoal({
          name: name.trim(),
          type: goalType,
          targetAmount: parsedAmount,
          targetDate: targetDate ? toIsoDate(targetDate) : undefined,
          interestRatePercent:
            goalType === "debt" && parsedRate != null && Number.isFinite(parsedRate)
              ? parsedRate
              : undefined,
        });

        if (success) {
          back();
        }
      }),
    [name, digits, goalType, targetDate, interestRate, createGoal, back, guardedCreate]
  );

  const handleDateChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (date) setTargetDate(date);
  }, []);

  const handleDateFieldPress = useCallback(() => {
    Keyboard.dismiss();
    setNumpadTarget(null);
    setShowDatePicker(true);
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Grab bar */}
      <View style={[styles.grabBar, { backgroundColor: borderColor }]} />

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
          onPress={handleDateFieldPress}
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

      {numpadTarget != null ? <FidyNumpad onKeyPress={handleKey} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grabBar: { width: 36, height: 5, borderRadius: 3, alignSelf: "center" },
  scrollContent: { padding: 24, gap: 16 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 18, textAlign: "center" },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleButton: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: { fontFamily: "Poppins_600SemiBold", fontSize: 13 },
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
  projectionHint: { fontFamily: "Poppins_500Medium", fontSize: 13, textAlign: "center" },
  createButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  createButtonText: { fontFamily: "Poppins_700Bold", fontSize: 16, color: "#FFFFFF" },
});
