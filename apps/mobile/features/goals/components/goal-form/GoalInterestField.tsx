import { MoneyEntryTextField } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./GoalForm.styles";

type GoalInterestFieldProps = {
  readonly interestRate: string;
  readonly onChange: (interestRate: string) => void;
  readonly onFocus: () => void;
};

export function GoalInterestField({ interestRate, onChange, onFocus }: GoalInterestFieldProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: primary }]}>{t("goals.create.interestRate")}</Text>
      <View style={styles.interestInputRow}>
        <MoneyEntryTextField
          label={t("goals.create.interestRate")}
          value={interestRate}
          onChangeText={onChange}
          onFocus={onFocus}
          keyboardType="decimal-pad"
          placeholder="0"
          style={styles.interestInput}
          labelStyle={{ display: "none" }}
        />
        <Text style={[styles.interestSuffix, { color: primary }]}>%</Text>
      </View>
    </View>
  );
}
