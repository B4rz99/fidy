import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";

export function IdentifierChip({ value }: { readonly value: string }) {
  const primary = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");

  return (
    <View style={[styles.identifierChip, { backgroundColor: peachLight }]}>
      <Text style={[styles.identifierChipText, { color: primary }]}>{value}</Text>
    </View>
  );
}
