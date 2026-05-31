import { TransactionDatePickerSheet } from "@/features/transactions/display.public";
import { FieldButton } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useCurrentDate, useTranslation } from "@/shared/hooks";
import { getMinimumGoalDate } from "./GoalDateField.helpers";
import { styles } from "./GoalSheet.styles";

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

  return (
    <View style={styles.fieldGroup}>
      <FieldButton
        label={t("goals.create.targetDate")}
        value={dateLabel}
        placeholder={t("goals.create.targetDate")}
        onPress={onPress}
        onClear={targetDate != null ? onClear : undefined}
        clearAccessibilityLabel={t("common.clear")}
      />
      <TransactionDatePickerSheet
        allowFuture
        date={targetDate ?? minimumDate}
        minimumDate={minimumDate}
        onChange={onChange}
        onClose={onClose}
        visible={showDatePicker}
      />
    </View>
  );
}
