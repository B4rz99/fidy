import { Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./GoalSheet.styles";

type GoalNameFieldProps = {
  readonly name: string;
  readonly onChange: (name: string) => void;
  readonly onFocus: () => void;
};

export function GoalNameField({ name, onChange, onFocus }: GoalNameFieldProps) {
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: primary }]}>{t("goals.create.goalName")}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: card, borderColor: borderSubtle, color: primary }]}
        placeholder={t("goals.create.goalNamePlaceholder")}
        placeholderTextColor={tertiary}
        value={name}
        onChangeText={onChange}
        onFocus={onFocus}
      />
    </View>
  );
}
