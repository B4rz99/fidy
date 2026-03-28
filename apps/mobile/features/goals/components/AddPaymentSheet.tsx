import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Animated from "react-native-reanimated";
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
import { useAsyncGuard, useBlinkingCursor, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, parseDigitsToAmount, toIsoDate } from "@/shared/lib";
import { useGoalStore } from "../store";

export function AddPaymentSheet() {
  const { back } = useRouter();
  const { t } = useTranslation();

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const addContribution = useGoalStore((s) => s.addContribution);

  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const [digits, setDigits] = useState("");
  const digitsRef = useRef(digits);
  digitsRef.current = digits;
  const [numpadActive, setNumpadActive] = useState(true);
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string>(toIsoDate(new Date()));

  // Blinking cursor
  const { cursorStyle } = useBlinkingCursor();

  const { isBusy: isAdding, run: guardedAdd } = useAsyncGuard();

  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : "$";

  const handleKey = useCallback((key: string) => {
    setDigits(handleNumpadPress(digitsRef.current, key));
  }, []);

  const handleAddPayment = useCallback(
    () =>
      guardedAdd(async () => {
        if (selectedGoalId == null) return;
        const amount = parseDigitsToAmount(digits);
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
    [selectedGoalId, digits, note, date, addContribution, back, guardedAdd]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: cardBg }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Grab bar */}
      <View style={[styles.grabBar, { backgroundColor: borderColor }]} />

      {/* Title */}
      <Text style={[styles.title, { color: primaryColor }]}>{t("goals.payment.title")}</Text>

      {/* Amount display with cursor — tappable to activate numpad */}
      <Pressable
        style={styles.amountSection}
        onPress={() => {
          Keyboard.dismiss();
          setNumpadActive(true);
        }}
      >
        <View style={styles.amountRow}>
          <Text style={[styles.amountDisplay, { color: primaryColor }]}>{displayAmount}</Text>
          {numpadActive ? (
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
          onFocus={() => setNumpadActive(false)}
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
          onFocus={() => setNumpadActive(false)}
        />
      </View>

      {/* Add payment button */}
      <Pressable
        style={[styles.ctaButton, { backgroundColor: accentGreen, opacity: isAdding ? 0.5 : 1 }]}
        onPress={() => {
          void handleAddPayment();
        }}
        disabled={isAdding}
      >
        <Text style={styles.ctaButtonText}>{t("goals.payment.addPaymentCta")}</Text>
      </Pressable>

      {numpadActive ? <FidyNumpad onKeyPress={handleKey} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grabBar: { width: 36, height: 5, borderRadius: 3, alignSelf: "center" },
  scrollContent: { padding: 24, gap: 16 },
  title: { fontFamily: "Poppins_700Bold", fontSize: 18, textAlign: "center" },
  amountSection: { alignItems: "center", paddingVertical: 8 },
  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  amountDisplay: { fontFamily: "Poppins_700Bold", fontSize: 32 },
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
  ctaButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  ctaButtonText: { fontFamily: "Poppins_700Bold", fontSize: 16, color: "#FFFFFF" },
});
