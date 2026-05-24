import type { ReactNode } from "react";
import { useTranslation } from "@/shared/hooks";
import { GoalAmountField } from "./GoalAmountField";
import { GoalDateField } from "./GoalDateField";
import { GoalInterestField } from "./GoalInterestField";
import { GoalNameField } from "./GoalNameField";
import { GoalSheetFrame } from "./GoalSheetFrame";
import { GoalTypeToggle } from "./GoalTypeToggle";
import type { GoalSheetFormModel } from "./useGoalSheetForm";

type GoalSheetFormProps = {
  readonly children: ReactNode;
  readonly form: GoalSheetFormModel;
  readonly fullScreen?: boolean;
  readonly showGoalTypeToggle?: boolean;
  readonly title: string;
};

export function GoalSheetForm({
  children,
  form,
  fullScreen = false,
  showGoalTypeToggle = false,
  title,
}: GoalSheetFormProps) {
  const { locale } = useTranslation();

  return (
    <GoalSheetFrame
      title={title}
      fullScreen={fullScreen}
      numpadEnabled={form.numpadTarget != null}
      onKeyPress={form.handleKey}
    >
      {showGoalTypeToggle ? (
        <GoalTypeToggle goalType={form.goalType} onChange={form.setGoalType} />
      ) : null}
      <GoalAmountField
        cursorStyle={form.cursorStyle}
        displayAmount={form.displayAmount}
        isAmountActive={form.numpadTarget === "amount"}
        onPress={form.handleAmountPress}
      />
      {form.goalType === "debt" ? (
        <GoalInterestField
          interestRate={form.interestRate}
          onChange={form.setInterestRate}
          onFocus={form.handleInterestRateFocus}
        />
      ) : null}
      <GoalNameField name={form.name} onChange={form.setName} onFocus={form.handleNameFocus} />
      <GoalDateField
        locale={locale}
        onChange={form.handleDateChange}
        onClose={form.handleDatePickerClose}
        onClear={form.clearTargetDate}
        onPress={form.handleDateFieldPress}
        showDatePicker={form.showDatePicker}
        targetDate={form.targetDate}
      />
      {children}
    </GoalSheetFrame>
  );
}
