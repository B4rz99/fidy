import { TransactionDatePickerDialog } from "@/features/transactions/ui.public";
import { MoneyEntryDateButton } from "@/shared/components";
import { Calendar } from "@/shared/components/icons";
import { useCurrentDate, useTranslation } from "@/shared/hooks";
import { getMinimumGoalDate } from "./GoalDateField.helpers";

type GoalDateFieldProps = {
  readonly locale: string;
  readonly onChange: (date: Date) => void;
  readonly onClose: () => void;
  readonly onClear: () => void;
  readonly onPress: () => void;
  readonly showDatePicker: boolean;
  readonly targetDate: Date | null;
};

export function GoalDateField({
  locale,
  onChange,
  onClose,
  onClear,
  onPress,
  showDatePicker,
  targetDate,
}: GoalDateFieldProps) {
  const { t } = useTranslation();
  const currentDate = useCurrentDate();
  const minimumDate = getMinimumGoalDate(currentDate);
  const dateLabel = targetDate
    ? targetDate.toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const currentDateLabel = currentDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <MoneyEntryDateButton
        icon={Calendar}
        label={t("goals.create.targetDate")}
        value={dateLabel}
        placeholder={currentDateLabel}
        onPress={onPress}
        onClear={targetDate != null ? onClear : undefined}
        clearAccessibilityLabel={t("common.clear")}
      />
      <TransactionDatePickerDialog
        allowFuture
        date={targetDate ?? minimumDate}
        minimumDate={minimumDate}
        onChange={onChange}
        onClose={onClose}
        visible={showDatePicker}
      />
    </>
  );
}
