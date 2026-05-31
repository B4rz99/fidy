import { FilterTextField } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";

type AmountFilterProps = {
  minDigits: string;
  maxDigits: string;
  onChangeMin: (digits: string) => void;
  onChangeMax: (digits: string) => void;
};

export const AmountFilter = ({
  minDigits,
  maxDigits,
  onChangeMin,
  onChangeMax,
}: AmountFilterProps) => {
  const { t } = useTranslation();

  const handleMinChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    onChangeMin(cleaned);
  };

  const handleMaxChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    onChangeMax(cleaned);
  };

  return (
    <View className="flex-row gap-3 p-4">
      <FilterTextField
        className="flex-1"
        label={t("search.min")}
        value={minDigits}
        onChangeText={handleMinChange}
        keyboardType="number-pad"
        placeholder="0"
      />
      <FilterTextField
        className="flex-1"
        label={t("search.max")}
        value={maxDigits}
        onChangeText={handleMaxChange}
        keyboardType="number-pad"
        placeholder="0"
      />
    </View>
  );
};
