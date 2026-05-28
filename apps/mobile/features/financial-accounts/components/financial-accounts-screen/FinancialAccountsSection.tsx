import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { FinancialAccountRow } from "./FinancialAccountRow";
import { styles } from "./FinancialAccountsScreen.styles";
import type { FinancialAccountListItem } from "./FinancialAccountsScreen.types";

export function FinancialAccountsSection({
  count,
  items,
  label,
  onOpenAccount,
}: {
  readonly count: number;
  readonly items: readonly FinancialAccountListItem[];
  readonly label: string;
  readonly onOpenAccount: (accountId: FinancialAccountListItem["account"]["id"]) => void;
}) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionLabel, { color: primary }]}>{label}</Text>
        <Text style={[styles.sectionCount, { color: secondary }]}>{count}</Text>
      </View>
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
