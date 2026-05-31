import { FormTextField } from "@/shared/components";
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
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: primary }]}>{t("goals.create.interestRate")}</Text>
      <View style={styles.interestInputRow}>
        <FormTextField
          label={t("goals.create.interestRate")}
          value={interestRate}
          onChangeText={onChange}
          onFocus={onFocus}
          keyboardType="decimal-pad"
          placeholder="0"
          style={styles.interestInput}
          labelStyle={{ display: "none" }}
          inputStyle={[
            styles.input,
            { backgroundColor: card, borderColor: borderSubtle, color: primary },
          ]}
        />
        <Text style={[styles.interestSuffix, { color: primary }]}>%</Text>
      </View>
    </View>
  );
}
