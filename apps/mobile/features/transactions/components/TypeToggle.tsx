import * as Haptics from "expo-haptics";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { useTranslation } from "@/shared/hooks";
import type { TransactionType } from "../schema";

type TypeToggleProps = {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
};

export const TypeToggle = ({ value, onChange }: TypeToggleProps) => {
  const { t } = useTranslation();

  const handlePress = (type: TransactionType) => {
    if (type !== value) {
      void Haptics.selectionAsync();
      onChange(type);
    }
  };

  return (
    <SegmentedControl
      className="w-56"
      options={[
        { value: "expense", label: t("transactions.expense") },
        { value: "income", label: t("transactions.income") },
      ]}
      value={value}
      onChange={handlePress}
      getOptionTone={(type) => (type === "expense" ? "danger" : "success")}
    />
  );
};
