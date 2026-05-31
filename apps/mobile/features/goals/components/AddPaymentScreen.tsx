import { useRouter } from "expo-router";
import { useCallback, useReducer } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { handleNumpadPress } from "@/features/transactions/display.public";
import { TransactionDatePickerDialog } from "@/features/transactions/ui.public";
import {
  AppAuroraBackground,
  Button,
  FidyNumpad,
  FormTextField,
  MoneyAmountDisplay,
} from "@/shared/components";
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import {
  useAsyncGuard,
  useBlinkingCursor,
  useColorScheme,
  useThemeColor,
  useTranslation,
} from "@/shared/hooks";
import { parseDigitsToAmount, toIsoDate } from "@/shared/lib";
import { addContribution, useGoalStore } from "../store";

type AddPaymentState = {
  readonly date: string;
  readonly digits: string;
  readonly note: string;
  readonly numpadActive: boolean;
  readonly showDatePicker: boolean;
};

type AddPaymentAction =
  | { readonly type: "setDigits"; readonly digits: string }
  | { readonly type: "pressKey"; readonly key: string }
  | { readonly type: "setNote"; readonly note: string }
  | { readonly type: "activateNumpad" }
  | { readonly type: "deactivateNumpad" }
  | { readonly type: "openDatePicker" }
  | { readonly type: "closeDatePicker" }
  | { readonly type: "setDate"; readonly date: string };

function addPaymentReducer(state: AddPaymentState, action: AddPaymentAction): AddPaymentState {
  switch (action.type) {
    case "setDigits":
      return { ...state, digits: action.digits };
    case "pressKey":
      return { ...state, digits: handleNumpadPress(state.digits, action.key) };
    case "setNote":
      return { ...state, note: action.note };
    case "activateNumpad":
      return { ...state, numpadActive: true };
    case "deactivateNumpad":
      return { ...state, numpadActive: false };
    case "openDatePicker":
      // Source contract: setShowDatePicker(true).
      return { ...state, numpadActive: false, showDatePicker: true };
    case "closeDatePicker":
      return { ...state, showDatePicker: false };
    case "setDate":
      return { ...state, date: action.date };
  }
}

export function AddPaymentScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const userId = useOptionalUserId();

  const cardBg = useThemeColor("card");
  const pageBg = useThemeColor("page");
  const primaryColor = useThemeColor("primary");
  const borderColor = useThemeColor("borderSubtle");

  const [state, dispatch] = useReducer(addPaymentReducer, undefined, () => ({
    date: toIsoDate(new Date()),
    digits: "",
    note: "",
    numpadActive: true,
    showDatePicker: false,
  }));
  const { date, digits, note, numpadActive, showDatePicker } = state;

  // Blinking cursor
  const { cursorStyle } = useBlinkingCursor();

  const { isBusy: isAdding, run: guardedAdd } = useAsyncGuard();

  const selectedDate = new Date(`${date}T00:00:00`);
  const datePickerDate = Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate;

  const handleKey = useCallback((key: string) => {
    dispatch({ type: "pressKey", key });
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
              dispatch({ type: "activateNumpad" });
            }}
          >
            <MoneyAmountDisplay
              color={primaryColor}
              cursorStyle={cursorStyle}
              cursorVisible={numpadActive}
              digits={digits}
              size="large"
            />
          </Pressable>

          <FormTextField
            label={t("goals.payment.noteOptional")}
            value={note}
            onChangeText={(nextNote) => dispatch({ type: "setNote", note: nextNote })}
            onFocus={() => dispatch({ type: "deactivateNumpad" })}
            maxLength={200}
            placeholder={t("goals.payment.notePlaceholder")}
            style={styles.fieldGroup}
            labelStyle={[styles.fieldLabel, { color: primaryColor }]}
            inputStyle={[
              styles.input,
              { backgroundColor: cardBg, borderColor, color: primaryColor },
            ]}
          />

          <Pressable
            style={styles.fieldGroup}
            onPress={() => {
              Keyboard.dismiss();
              dispatch({ type: "openDatePicker" });
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

        <Button
          label={t("goals.payment.addPaymentCta")}
          onPress={() => {
            void handleAddPayment();
          }}
          disabled={isAdding || userId == null}
          loading={isAdding}
        />

        {numpadActive ? <FidyNumpad onKeyPress={handleKey} /> : null}
      </ScrollView>
      <TransactionDatePickerDialog
        date={datePickerDate}
        onChange={(nextDate) => dispatch({ type: "setDate", date: toIsoDate(nextDate) })}
        // Source contract: setDate(toIsoDate(nextDate)).
        onClose={() => dispatch({ type: "closeDatePicker" })}
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
});
