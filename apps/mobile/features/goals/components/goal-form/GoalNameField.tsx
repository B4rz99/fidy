import { FormTextField } from "@/shared/components";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./GoalForm.styles";

type GoalNameFieldProps = {
  readonly name: string;
  readonly onChange: (name: string) => void;
  readonly onFocus: () => void;
};

export function GoalNameField({ name, onChange, onFocus }: GoalNameFieldProps) {
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <FormTextField
      label={t("goals.create.goalName")}
      value={name}
      onChangeText={onChange}
      onFocus={onFocus}
      placeholder={t("goals.create.goalNamePlaceholder")}
      style={styles.fieldGroup}
      labelStyle={[styles.fieldLabel, { color: primary }]}
      inputStyle={[
        styles.input,
        { backgroundColor: card, borderColor: borderSubtle, color: primary },
      ]}
    />
  );
}
