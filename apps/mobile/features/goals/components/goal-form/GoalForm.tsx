import type { ReactNode } from "react";
import { View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { GoalAmountField } from "./GoalAmountField";
import { GoalDateField } from "./GoalDateField";
import { GoalInterestField } from "./GoalInterestField";
import { GoalNameField } from "./GoalNameField";
import { styles } from "./GoalForm.styles";
import { GoalFormFrame } from "./GoalFormFrame";
import { GoalTypeToggle } from "./GoalTypeToggle";
import type { GoalFormModel } from "./useGoalForm";

type GoalFormProps = {
  readonly children: ReactNode;
  readonly form: GoalFormModel;
  readonly headerTitle: string;
  readonly onBack?: () => void;
  readonly showGoalTypeToggle?: boolean;
};

export function GoalForm({
  children,
  form,
  headerTitle,
  onBack,
  showGoalTypeToggle = false,
}: GoalFormProps) {
  const { locale } = useTranslation();
  const typeToggle = showGoalTypeToggle ? (
    <GoalTypeToggle goalType={form.goalType} onChange={form.setGoalType} />
  ) : null;
  const amountField = <GoalAmountField digits={form.digits} onPress={form.handleAmountPress} />;
  const nameField = (
    <GoalNameField
      name={form.name}
      onBlur={form.handleManualFieldBlur}
      onChange={form.setName}
      onFocus={form.handleNameFocus}
    />
  );
  const interestField = (
    <GoalInterestField
      interestRate={form.interestRate}
      onBlur={form.handleManualFieldBlur}
      onChange={form.setInterestRate}
      onFocus={form.handleInterestRateFocus}
    />
  );
  const nameAndRateFields =
    form.goalType === "debt" ? (
      <View style={styles.goalNameRateRow}>
        <View style={styles.goalNameColumn}>{nameField}</View>
        <View style={styles.goalRateColumn}>{interestField}</View>
      </View>
    ) : (
      nameField
    );
  const detailFields = (
    <>
      {nameAndRateFields}
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
      headerTitle={headerTitle}
      numpadEnabled={form.numpadTarget != null}
      onBack={onBack}
      onKeyPress={form.handleKey}
      topContent={typeToggle}
    />
  );
}
