import DateTimePicker from "@expo/ui/community/datetime-picker";
import { Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getMinimumGoalDate } from "./GoalDateField.helpers";
import { styles } from "./GoalSheet.styles";

type GoalDateFieldProps = {
  readonly locale: string;
  readonly onChange: (_event: unknown, date?: Date) => void;
  readonly onClear: () => void;
  readonly onPress: () => void;
  readonly showDatePicker: boolean;
  readonly targetDate: Date | null;
};

export function GoalDateField({
  locale,
  onChange,
  onClear,
  onPress,
  showDatePicker,
  targetDate,
}: GoalDateFieldProps) {
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");
  const minimumDate = getMinimumGoalDate();

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
      {showDatePicker ? (
        <DateTimePicker
          value={targetDate ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minimumDate}
          onChange={onChange}
          accentColor={accentGreen}
        />
      ) : null}
    </View>
  );
}
