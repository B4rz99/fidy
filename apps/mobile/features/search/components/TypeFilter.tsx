import * as Haptics from "expo-haptics";
import { SegmentedControl } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

type FilterType = "all" | "expense" | "income" | "transfer";

type TypeFilterProps = {
  value: FilterType;
  onChange: (type: FilterType) => void;
};

export const TypeFilter = ({ value, onChange }: TypeFilterProps) => {
  const { t } = useTranslation();
  const options = [
    { value: "all", label: t("search.allTypes") },
    { value: "expense", label: t("transactions.expense") },
    { value: "income", label: t("transactions.income") },
    { value: "transfer", label: t("search.transferType") },
  ] as const;

  const handlePress = (type: FilterType) => {
    void Haptics.selectionAsync();
    onChange(type === value ? "all" : type);
  };

  return (
    <SegmentedControl
      options={options}
      value={value}
      onChange={handlePress}
      allowReselect
      variant="detached"
    />
  );
};
