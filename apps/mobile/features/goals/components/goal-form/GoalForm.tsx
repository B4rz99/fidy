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
  const typeToggle = showGoalTypeToggle ? (
    <GoalTypeToggle goalType={form.goalType} onChange={form.setGoalType} />
  ) : null;
  const amountField = (
    <GoalAmountField
      cursorStyle={form.cursorStyle}
      digits={form.digits}
      hideLabel={fullScreen}
      isAmountActive={form.numpadTarget === "amount"}
      onPress={form.handleAmountPress}
      size={fullScreen ? "hero" : "medium"}
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
      title={title}
      actionContent={children}
      amountContent={amountField}
      detailContent={detailFields}
      fullScreen={fullScreen}
      numpadEnabled={form.numpadTarget != null}
      onKeyPress={form.handleKey}
      topContent={typeToggle}
    >
      {typeToggle}
      {amountField}
      {detailFields}
      {children}
    </GoalFormFrame>
  );
}
