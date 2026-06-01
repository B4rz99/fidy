import { MoneyEntryTextField } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

type GoalNameFieldProps = {
  readonly name: string;
  readonly onChange: (name: string) => void;
  readonly onFocus: () => void;
};

export function GoalNameField({ name, onChange, onFocus }: GoalNameFieldProps) {
  const { t } = useTranslation();

  return (
    <MoneyEntryTextField
      label={t("goals.create.goalName")}
      value={name}
      onChangeText={onChange}
      onFocus={onFocus}
      placeholder={t("goals.create.goalNamePlaceholder")}
    />
  );
}
