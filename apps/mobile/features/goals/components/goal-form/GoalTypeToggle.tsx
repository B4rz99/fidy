import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { useTranslation } from "@/shared/hooks";
import type { GoalType } from "../../schema";

type GoalTypeToggleProps = {
  readonly goalType: GoalType;
  readonly onChange: (goalType: GoalType) => void;
};

export function GoalTypeToggle({ goalType, onChange }: GoalTypeToggleProps) {
  const { t } = useTranslation();

  return (
    <SegmentedControl
      options={[
        { value: "savings", label: t("goals.create.typeSavings") },
        { value: "debt", label: t("goals.create.typeDebt") },
      ]}
      value={goalType}
      onChange={onChange}
      getOptionTone={(type) => (type === "debt" ? "danger" : "success")}
    />
  );
}
