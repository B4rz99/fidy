import { useCallback, useRef, useState } from "react";
import { handleNumpadPress } from "@/features/transactions/display.public";
import { Keyboard } from "@/shared/components/rn";
import { useBlinkingCursor } from "@/shared/hooks";
import { parseDigitsToAmount } from "@/shared/lib";
import type { GoalType } from "../../schema";

export type GoalFormCursorStyle = ReturnType<typeof useBlinkingCursor>["cursorStyle"];

export type GoalFormModel = {
  readonly amount: number;
  readonly cursorStyle: GoalFormCursorStyle;
  readonly digits: string;
  readonly goalType: GoalType;
  readonly handleAmountPress: () => void;
  readonly handleDateChange: (date: Date) => void;
  readonly handleDatePickerClose: () => void;
  readonly handleDateFieldPress: () => void;
  readonly handleInterestRateFocus: () => void;
  readonly handleKey: (key: string) => void;
  readonly handleNameFocus: () => void;
  readonly interestRate: string;
  readonly name: string;
  readonly numpadTarget: "amount" | null;
  readonly setGoalType: (goalType: GoalType) => void;
  readonly setInterestRate: (interestRate: string) => void;
  readonly setName: (name: string) => void;
  readonly showDatePicker: boolean;
  readonly targetDate: Date | null;
  readonly clearTargetDate: () => void;
};

type GoalFormOptions = {
  readonly initialDigits?: string;
  readonly initialGoalType: GoalType;
  readonly initialInterestRate?: string;
  readonly initialName?: string;
  readonly initialNumpadTarget?: "amount" | null;
  readonly initialTargetDate?: Date | null;
};

function useGoalFormManualFocus(
  setNumpadTarget: (value: "amount" | null) => void,
  setShowDatePicker: (value: boolean) => void
) {
  return useCallback(() => {
    setNumpadTarget(null);
    setShowDatePicker(false);
  }, [setNumpadTarget, setShowDatePicker]);
}

function useGoalFormDates(initialTargetDate: Date | null) {
  const [targetDate, setTargetDate] = useState<Date | null>(initialTargetDate ?? null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  return {
    clearTargetDate: useCallback(() => {
      setTargetDate(null);
      setShowDatePicker(false);
    }, []),
    handleDateChange: useCallback((date: Date) => {
      setTargetDate(date);
    }, []),
    handleDatePickerClose: useCallback(() => setShowDatePicker(false), []),
    handleDateFieldPress: useCallback(() => {
      Keyboard.dismiss();
      setShowDatePicker(true);
    }, []),
    setShowDatePicker,
    showDatePicker,
    targetDate,
  };
}

function useGoalFormNumpad(
  initialDigits: string,
  initialTarget: "amount" | null,
  setShowDatePicker: (value: boolean) => void
) {
  const [digits, setDigits] = useState(initialDigits);
  const [numpadTarget, setNumpadTarget] = useState<"amount" | null>(initialTarget);
  const digitsRef = useRef(digits);
  digitsRef.current = digits;

  return {
    digits,
    handleAmountPress: useCallback(() => {
      Keyboard.dismiss();
      setShowDatePicker(false);
      setNumpadTarget("amount");
    }, [setShowDatePicker]),
    handleKey: useCallback(
      (key: string) => {
        if (numpadTarget === "amount") {
          setDigits(handleNumpadPress(digitsRef.current, key));
        }
      },
      [numpadTarget]
    ),
    numpadTarget,
    setNumpadTarget,
  };
}

export function useGoalForm(options: GoalFormOptions): GoalFormModel {
  const [goalType, setGoalType] = useState<GoalType>(options.initialGoalType);
  const [name, setName] = useState(options.initialName ?? "");
  const [interestRate, setInterestRate] = useState(options.initialInterestRate ?? "");
  const { cursorStyle } = useBlinkingCursor();
  const dates = useGoalFormDates(options.initialTargetDate ?? null);
  const numpad = useGoalFormNumpad(
    options.initialDigits ?? "",
    options.initialNumpadTarget ?? null,
    dates.setShowDatePicker
  );
  const handleManualFieldFocus = useGoalFormManualFocus(
    numpad.setNumpadTarget,
    dates.setShowDatePicker
  );

  return {
    amount: parseDigitsToAmount(numpad.digits),
    cursorStyle,
    digits: numpad.digits,
    goalType,
    handleAmountPress: numpad.handleAmountPress,
    handleDateChange: dates.handleDateChange,
    handleDatePickerClose: dates.handleDatePickerClose,
    handleDateFieldPress: useCallback(() => {
      handleManualFieldFocus();
      dates.handleDateFieldPress();
    }, [dates.handleDateFieldPress, handleManualFieldFocus]),
    handleInterestRateFocus: handleManualFieldFocus,
    handleKey: numpad.handleKey,
    handleNameFocus: handleManualFieldFocus,
    interestRate,
    name,
    numpadTarget: numpad.numpadTarget,
    setGoalType,
    setInterestRate,
    setName,
    showDatePicker: dates.showDatePicker,
    targetDate: dates.targetDate,
    clearTargetDate: dates.clearTargetDate,
  };
}
