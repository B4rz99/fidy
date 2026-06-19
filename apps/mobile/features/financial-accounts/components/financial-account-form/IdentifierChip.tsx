import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";

export function IdentifierChip({ value }: { readonly value: string }) {
  const primary = useThemeColor("primary");

  return (
    <View style={styles.identifierChip}>
      <Text style={[styles.identifierChipText, { color: primary }]}>{value}</Text>
    </View>
  );
}
