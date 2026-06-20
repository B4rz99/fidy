import { FilterTextField } from "@/shared/components";
import { StyleSheet, View } from "@/shared/components/rn";
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
  const surfaceRaised = useThemeColor("surfaceRaised");

  const handleMinChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    onChangeMin(cleaned);
  };

  const handleMaxChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    onChangeMax(cleaned);
  };

  return (
    <View style={styles.container}>
      <FilterTextField
        inputStyle={styles.input}
        label={t("search.min")}
        labelStyle={[styles.label, { color: primary }]}
        keyboardType="number-pad"
        onChangeText={handleMinChange}
        placeholder="0"
        style={styles.field}
        surfaceBackgroundColor={surfaceRaised}
        value={minDigits}
      />
      <FilterTextField
        inputStyle={styles.input}
        label={t("search.max")}
        labelStyle={[styles.label, { color: primary }]}
        keyboardType="number-pad"
        onChangeText={handleMaxChange}
        placeholder="0"
        style={styles.field}
        surfaceBackgroundColor={surfaceRaised}
        value={maxDigits}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  input: {
    flex: 1,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    padding: 0,
  },
});
