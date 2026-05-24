import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { useOptionalUserId } from "@/features/auth/public";
import {
  handleNumpadPress,
  TransactionDatePickerSheet,
} from "@/features/transactions/display.public";
import { AppAuroraBackground, FidyNumpad } from "@/shared/components";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import {
  useAsyncGuard,
  useBlinkingCursor,
  useColorScheme,
  useThemeColor,
  useTranslation,
} from "@/shared/hooks";
import { formatInputDisplay, parseDigitsToAmount, toIsoDate } from "@/shared/lib";
import { addContribution, useGoalStore } from "../store";

export function AddPaymentSheet() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const userId = useOptionalUserId();

  const cardBg = useThemeColor("card");
  const pageBg = useThemeColor("page");
  const primaryColor = useThemeColor("primary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const [digits, setDigits] = useState("");
  const digitsRef = useRef(digits);
  digitsRef.current = digits;
  const [numpadActive, setNumpadActive] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string>(toIsoDate(new Date()));

  // Blinking cursor
  const { cursorStyle } = useBlinkingCursor();

  const { isBusy: isAdding, run: guardedAdd } = useAsyncGuard();

  const displayAmount = digits.length > 0 ? formatInputDisplay(digits) : "$";
  const selectedDate = new Date(`${date}T00:00:00`);

  const handleKey = useCallback((key: string) => {
    setDigits(handleNumpadPress(digitsRef.current, key));
  }, []);

  const handleAddPayment = useCallback(
    () =>
      guardedAdd(async () => {
        if (selectedGoalId == null) return;
        if (!userId) return;
        const db = tryGetDb(userId);
        if (!db) return;
        const amount = parseDigitsToAmount(digits);
        if (amount <= 0) return;

        const success = await addContribution(db, userId, {
          goalId: selectedGoalId,
          amount,
          note: note.trim() || undefined,
          date,
        });

        if (success) {
          back();
        }
      }),
    [selectedGoalId, digits, note, date, back, guardedAdd, userId]
  );

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <AppAuroraBackground isDark={isDark} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 24 }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="always"
      >
        <View style={[styles.paymentCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.fieldLabel, { color: primaryColor }]}>
            {t("goals.payment.amount")}
          </Text>

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

          <Pressable
            style={styles.fieldGroup}
            onPress={() => {
              Keyboard.dismiss();
              setNumpadActive(false);
              setShowDatePicker(true);
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.fieldLabel, { color: primaryColor }]}>
              {t("goals.payment.date")}
            </Text>
            <View
              style={[styles.input, styles.dateButton, { backgroundColor: cardBg, borderColor }]}
            >
              <Text style={[styles.dateText, { color: primaryColor }]}>{date}</Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          style={[styles.ctaButton, { backgroundColor: accentGreen, opacity: isAdding ? 0.5 : 1 }]}
          onPress={() => {
            void handleAddPayment();
          }}
          disabled={isAdding || userId == null}
        >
          <Text style={styles.ctaButtonText}>{t("goals.payment.addPaymentCta")}</Text>
        </Pressable>

        {numpadActive ? <FidyNumpad onKeyPress={handleKey} /> : null}
      </ScrollView>
      <TransactionDatePickerSheet
        date={Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate}
        onChange={(nextDate) => setDate(toIsoDate(nextDate))}
        onClose={() => setShowDatePicker(false)}
        visible={showDatePicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, gap: 16 },
  paymentCard: {
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: "continuous",
    padding: 16,
    gap: 16,
  },
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
  dateButton: { justifyContent: "center" },
  dateText: { fontFamily: "Poppins_500Medium", fontSize: 14 },
  ctaButton: {
    borderRadius: 12,
    borderCurve: "continuous",
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  ctaButtonText: { fontFamily: "Poppins_700Bold", fontSize: 16, color: "#FFFFFF" },
});
