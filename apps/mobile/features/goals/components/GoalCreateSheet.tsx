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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, parseDigitsToAmount } from "@/shared/lib";
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
  const [digits, setDigits] = useState("");
  const digitsRef = useRef(digits);
  digitsRef.current = digits;
  const [interestDigits, setInterestDigits] = useState("");
  const interestDigitsRef = useRef(interestDigits);
  interestDigitsRef.current = interestDigits;
  const [numpadTarget, setNumpadTarget] = useState<"amount" | "interestRate" | null>("amount");
  const [targetDate, setTargetDate] = useState("");

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
      } else if (numpadTarget === "interestRate") {
        setInterestDigits(handleNumpadPress(interestDigitsRef.current, key));
      }
    },
    [numpadTarget]
  );

  const handleCreate = useCallback(
    () =>
      guardedCreate(async () => {
        const parsedAmount = parseDigitsToAmount(digits);
        if (!name.trim() || parsedAmount <= 0) return;

        const success = await createGoal({
          name: name.trim(),
          type: goalType,
          targetAmount: parsedAmount,
          targetDate: targetDate.trim() || undefined,
          interestRatePercent:
            goalType === "debt" && interestDigits ? parseDigitsToAmount(interestDigits) : undefined,
        });

        if (success) {
          back();
        }
      }),
    [name, digits, goalType, targetDate, interestDigits, createGoal, back, guardedCreate]
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
            <Text style={[styles.amountDisplay, { color: primaryColor, fontSize: 24 }]}>
              {interestDigits.length > 0 ? `${interestDigits}%` : "0%"}
            </Text>
            {numpadTarget === "interestRate" ? (
              <Animated.View
                style={[
                  {
                    width: 2,
                    height: 22,
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

      {numpadTarget != null ? <FidyNumpad onKeyPress={handleKey} /> : null}
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
  amountSection: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  amountDisplay: {
    fontFamily: "Poppins_700Bold",
    fontSize: 32,
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
