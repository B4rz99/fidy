import * as Haptics from "expo-haptics";
import { SegmentedControl } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

type FilterType = "all" | "expense" | "income" | "transfer";
type SelectableFilterType = Exclude<FilterType, "all">;

type TypeFilterProps = {
  value: FilterType;
  onChange: (type: FilterType) => void;
};

export const TypeFilter = ({ value, onChange }: TypeFilterProps) => {
  const { t } = useTranslation();
  const options = [
    { value: "expense", label: t("transactions.expense") },
    { value: "income", label: t("transactions.income") },
    { value: "transfer", label: t("search.transfers") },
  ] as const;

  const handlePress = (type: SelectableFilterType) => {
    void Haptics.selectionAsync();
    onChange(type === value ? "all" : type);
  };

  return (
    <SegmentedControl
      options={options}
      value={value === "all" ? null : value}
      onChange={handlePress}
      getOptionTone={(type) =>
        type === "expense" ? "danger" : type === "income" ? "success" : "primary"
      }
    />
  );
};
