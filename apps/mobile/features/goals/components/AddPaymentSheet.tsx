import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { toIsoDate } from "@/shared/lib";
import {
  cleanDigitInput,
  formatInputDisplay,
  parseDigitsToAmount,
} from "@/shared/lib/format-money";
import { useGoalStore } from "../store";

export function AddPaymentSheet() {
  const { back } = useRouter();
  const { t } = useTranslation();

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const addContribution = useGoalStore((s) => s.addContribution);

  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const [amountDigits, setAmountDigits] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toIsoDate(new Date()));

  const { isBusy: isAdding, run: guardedAdd } = useAsyncGuard();

  const handleAmountChange = useCallback((text: string) => {
    setAmountDigits(cleanDigitInput(text));
  }, []);

  const handleAddPayment = useCallback(
    () =>
      guardedAdd(async () => {
        if (selectedGoalId == null) return;

        const amount = parseDigitsToAmount(amountDigits);
        if (amount <= 0) return;

        const success = await addContribution({
          goalId: selectedGoalId,
          amount,
          note: note.trim() || undefined,
          date,
        });

        if (success) {
          back();
        }
      }),
    [selectedGoalId, amountDigits, note, date, addContribution, back, guardedAdd]
  );

  const displayAmount = amountDigits ? formatInputDisplay(amountDigits) : "";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text style={[styles.title, { color: primaryColor }]}>{t("goals.payment.title")}</Text>

      {/* Amount display */}
      <View style={styles.amountDisplayContainer}>
        <Text style={[styles.amountDisplay, { color: primaryColor }]}>
          {displayAmount || "COP $0"}
        </Text>
      </View>

      {/* Amount input */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>
          {t("goals.payment.amount")}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, borderColor, color: primaryColor }]}
          placeholder="COP $0"
          placeholderTextColor={tertiaryColor}
          value={amountDigits}
          onChangeText={handleAmountChange}
          keyboardType="numeric"
          autoFocus
        />
      </View>

      {/* Note (optional) */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>
          {t("goals.payment.noteOptional")}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, borderColor, color: primaryColor }]}
          placeholder={t("goals.payment.notePlaceholder")}
          placeholderTextColor={tertiaryColor}
          value={note}
          onChangeText={setNote}
          maxLength={200}
        />
      </View>

      {/* Date */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: primaryColor }]}>{t("goals.payment.date")}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: cardBg, borderColor, color: primaryColor }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={tertiaryColor}
          value={date}
          onChangeText={setDate}
        />
      </View>

      {/* Add payment button */}
      <Pressable
        style={[styles.ctaButton, { backgroundColor: accentGreen, opacity: isAdding ? 0.5 : 1 }]}
        onPress={handleAddPayment}
        disabled={isAdding}
      >
        <Text style={styles.ctaButtonText}>{t("goals.payment.addPaymentCta")}</Text>
      </Pressable>

      {/* Subtle hint */}
      <Text style={[styles.hint, { color: secondaryColor }]}>
        {displayAmount ? displayAmount : ""}
      </Text>
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
  amountDisplayContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  amountDisplay: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 28,
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
  ctaButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  ctaButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  hint: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    textAlign: "center",
  },
});
