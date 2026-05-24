import { TransactionDatePickerSheet } from "@/features/transactions/display.public";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useCurrentDate, useThemeColor, useTranslation } from "@/shared/hooks";
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
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");
  const currentDate = useCurrentDate();
  const minimumDate = getMinimumGoalDate(currentDate);

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: primary }]}>{t("goals.create.targetDate")}</Text>
      <Pressable
        style={[
          styles.input,
          styles.dateButton,
          { backgroundColor: card, borderColor: borderSubtle },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.dateText, { color: targetDate ? primary : tertiary }]}>
          {targetDate
            ? targetDate.toLocaleDateString(locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : t("goals.create.targetDate")}
        </Text>
        {targetDate != null ? (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={[styles.clearDateText, { color: accentRed }]}>✕</Text>
          </Pressable>
        ) : null}
      </Pressable>
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
