import type { StoredTransaction } from "@/features/transactions/query.public";
import { Text, View } from "@/shared/components/rn";
import { formatMoney } from "@/shared/lib";
import { styles } from "./SyncProgressStep.styles";

export function SyncTransactionPreview({
  fallbackLabel,
  primaryColor,
  secondaryColor,
  title,
  transactions,
}: {
  readonly fallbackLabel: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly title: string;
  readonly transactions: readonly StoredTransaction[];
}) {
  if (transactions.length === 0) return null;

  return (
    <View style={styles.previewSection}>
      <Text style={[styles.previewTitle, { color: secondaryColor }]}>{title}</Text>
      {transactions.map((tx) => (
        <View key={tx.id} style={styles.previewRow}>
          <Text style={[styles.previewDescription, { color: primaryColor }]} numberOfLines={1}>
            {tx.description || fallbackLabel}
          </Text>
          <Text style={[styles.previewAmount, { color: primaryColor }]}>
            {formatMoney(tx.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}
