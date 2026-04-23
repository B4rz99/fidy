import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { FinancialAccountRow } from "./FinancialAccountRow";
import { styles } from "./FinancialAccountsScreen.styles";
import type { FinancialAccountListItem } from "./FinancialAccountsScreen.types";

export function FinancialAccountsSection({
  items,
  label,
  onOpenAccount,
}: {
  readonly items: readonly FinancialAccountListItem[];
  readonly label: string;
  readonly onOpenAccount: (accountId: FinancialAccountListItem["account"]["id"]) => void;
}) {
  const secondary = useThemeColor("secondary");

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: secondary }]}>{label}</Text>
      {items.map((item) => (
        <FinancialAccountRow
          key={item.account.id}
          item={item}
          onPress={() => onOpenAccount(item.account.id)}
        />
      ))}
    </View>
  );
}
