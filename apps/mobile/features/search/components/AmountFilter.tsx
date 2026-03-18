import { Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

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
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const peachLight = useThemeColor("peachLight");

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
      <View className="flex-1">
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark mb-1">
          {t("search.min")}
        </Text>
        <TextInput
          className="h-10 rounded-lg px-3 font-poppins-medium text-body"
          style={{ backgroundColor: peachLight, color: primary }}
          value={minDigits}
          onChangeText={handleMinChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={secondary}
        />
      </View>
      <View className="flex-1">
        <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark mb-1">
          {t("search.max")}
        </Text>
        <TextInput
          className="h-10 rounded-lg px-3 font-poppins-medium text-body"
          style={{ backgroundColor: peachLight, color: primary }}
          value={maxDigits}
          onChangeText={handleMaxChange}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={secondary}
        />
      </View>
    </View>
  );
};
