import { useRouter } from "expo-router";
import { useCallback, useReducer } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { handleNumpadPress } from "@/features/transactions/display.public";
import { TransactionDatePickerDialog } from "@/features/transactions/ui.public";
import { Button, FormTextField, MoneyAmountDisplay, MoneyEntryScreen } from "@/shared/components";
import { Keyboard, Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useBlinkingCursor, useThemeColor, useTranslation } from "@/shared/hooks";
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

  const selectedGoalId = useGoalStore((s) => s.selectedGoalId);
  const userId = useOptionalUserId();

  const cardBg = useThemeColor("card");
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
    <>
      <MoneyEntryScreen
        actionContent={
          <Button
            label={t("goals.payment.addPaymentCta")}
            onPress={() => {
              void handleAddPayment();
            }}
            disabled={isAdding || userId == null}
            loading={isAdding}
          />
        }
        detailContent={
          <>
            <FormTextField
              label={t("goals.payment.noteOptional")}
              value={note}
              onChangeText={(nextNote) => dispatch({ type: "setNote", note: nextNote })}
              onFocus={() => dispatch({ type: "deactivateNumpad" })}
              maxLength={200}
              placeholder={t("goals.payment.notePlaceholder")}
              style={styles.fieldGroup}
              labelStyle={[styles.fieldLabel, { color: primaryColor }]}
              inputStyle={[styles.input, { backgroundColor: cardBg, borderColor }]}
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
          </>
        }
        amountContent={
          <Pressable
            style={styles.amountSection}
            onPress={() => {
              Keyboard.dismiss();
              dispatch({ type: "activateNumpad" });
            }}
            accessibilityRole="button"
            accessibilityLabel={t("goals.payment.amount")}
          >
            <MoneyAmountDisplay
              color={primaryColor}
              cursorStyle={cursorStyle}
              cursorVisible={numpadActive}
              digits={digits}
              size="hero"
            />
          </Pressable>
        }
        numpadVisible={numpadActive}
        onKeyPress={handleKey}
      >
        {null}
      </MoneyEntryScreen>
      <TransactionDatePickerDialog
        date={datePickerDate}
        onChange={(nextDate) => dispatch({ type: "setDate", date: toIsoDate(nextDate) })}
        // Source contract: setDate(toIsoDate(nextDate)).
        onClose={() => dispatch({ type: "closeDatePicker" })}
        visible={showDatePicker}
      />
    </>
  );
}

const styles = StyleSheet.create({
  amountSection: { alignItems: "center" },
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
