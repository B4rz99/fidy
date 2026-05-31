import type { ReactNode } from "react";
import { useTranslation } from "@/shared/hooks";
import { GoalAmountField } from "./GoalAmountField";
import { GoalDateField } from "./GoalDateField";
import { GoalInterestField } from "./GoalInterestField";
import { GoalNameField } from "./GoalNameField";
import { GoalFormFrame } from "./GoalFormFrame";
import { GoalTypeToggle } from "./GoalTypeToggle";
import type { GoalFormModel } from "./useGoalForm";

type GoalFormProps = {
  readonly children: ReactNode;
  readonly form: GoalFormModel;
  readonly fullScreen?: boolean;
  readonly showGoalTypeToggle?: boolean;
  readonly title: string;
};

export function GoalForm({
  children,
  form,
  fullScreen = false,
  showGoalTypeToggle = false,
  title,
}: GoalFormProps) {
  const { locale } = useTranslation();

  return (
    <GoalFormFrame
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
    </GoalFormFrame>
  );
}
