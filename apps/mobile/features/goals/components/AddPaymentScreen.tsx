import { useRouter } from "expo-router";
import { useCallback, useReducer } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { handleNumpadPress } from "@/features/transactions/display.public";
import { TransactionDatePickerDialog } from "@/features/transactions/ui.public";
import {
  Button,
  MoneyEntryAmountField,
  MoneyEntryDateButton,
  MoneyEntryScreen,
  MoneyEntryTextField,
} from "@/shared/components";
import { Keyboard } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useBlinkingCursor, useTranslation } from "@/shared/hooks";
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
            <MoneyEntryTextField
              label={t("goals.payment.noteOptional")}
              value={note}
              onChangeText={(nextNote) => dispatch({ type: "setNote", note: nextNote })}
              onFocus={() => dispatch({ type: "deactivateNumpad" })}
              maxLength={200}
              placeholder={t("goals.payment.notePlaceholder")}
            />

            <MoneyEntryDateButton
              label={t("goals.payment.date")}
              value={date}
              onPress={() => {
                Keyboard.dismiss();
                dispatch({ type: "openDatePicker" });
              }}
            />
          </>
        }
        amountContent={
          <MoneyEntryAmountField
            onPress={() => {
              Keyboard.dismiss();
              dispatch({ type: "activateNumpad" });
            }}
            accessibilityLabel={t("goals.payment.amount")}
            cursorStyle={cursorStyle}
            cursorVisible={numpadActive}
            digits={digits}
          />
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
