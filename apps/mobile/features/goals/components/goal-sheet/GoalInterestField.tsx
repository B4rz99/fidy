import { Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./GoalSheet.styles";

type GoalInterestFieldProps = {
  readonly interestRate: string;
  readonly onChange: (interestRate: string) => void;
  readonly onFocus: () => void;
};

export function GoalInterestField({ interestRate, onChange, onFocus }: GoalInterestFieldProps) {
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: primary }]}>{t("goals.create.interestRate")}</Text>
      <View style={styles.interestInputRow}>
        <TextInput
          style={[
            styles.input,
            styles.interestInput,
            { backgroundColor: card, borderColor: borderSubtle, color: primary },
          ]}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={tertiary}
          value={interestRate}
          onChangeText={onChange}
          onFocus={onFocus}
        />
        <Text style={[styles.interestSuffix, { color: primary }]}>%</Text>
      </View>
    </View>
  );
}
