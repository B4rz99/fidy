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
  readonly showGoalTypeToggle?: boolean;
};

export function GoalForm({ children, form, showGoalTypeToggle = false }: GoalFormProps) {
  const { locale } = useTranslation();
  const typeToggle = showGoalTypeToggle ? (
    <GoalTypeToggle goalType={form.goalType} onChange={form.setGoalType} />
  ) : null;
  const amountField = (
    <GoalAmountField
      cursorStyle={form.cursorStyle}
      digits={form.digits}
      isAmountActive={form.numpadTarget === "amount"}
      onPress={form.handleAmountPress}
    />
  );
  const interestField =
    form.goalType === "debt" ? (
      <GoalInterestField
        interestRate={form.interestRate}
        onChange={form.setInterestRate}
        onFocus={form.handleInterestRateFocus}
      />
    ) : null;
  const detailFields = (
    <>
      {interestField}
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
    </>
  );

  return (
    <GoalFormFrame
      actionContent={children}
      amountContent={amountField}
      detailContent={detailFields}
      numpadEnabled={form.numpadTarget != null}
      onKeyPress={form.handleKey}
      topContent={typeToggle}
    />
  );
}
