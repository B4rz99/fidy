import { MoneyEntryTextField } from "@/shared/components";
import { Target } from "@/shared/components/icons";
import { useTranslation } from "@/shared/hooks";

type GoalNameFieldProps = {
  readonly name: string;
  readonly onChange: (name: string) => void;
  readonly onBlur: () => void;
  readonly onFocus: () => void;
};

export function GoalNameField({ name, onBlur, onChange, onFocus }: GoalNameFieldProps) {
  const { t } = useTranslation();

  return (
    <MoneyEntryTextField
      icon={Target}
      label={t("goals.create.goalName")}
      value={name}
      onChangeText={onChange}
      onBlur={onBlur}
      onFocus={onFocus}
      placeholder={t("goals.create.goalNamePlaceholder")}
    />
  );
}
