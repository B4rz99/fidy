import type { ReactNode } from "react";
import { Card, ListRowSurface } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./FinancialAccountDetailsScreen.styles";

export function FinancialAccountDetailSection({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  const primary = useThemeColor("primary");

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: primary }]}>{title}</Text>
      <Card padded={false} radius={18}>
        {children}
      </Card>
    </View>
  );
}

export function FinancialAccountFieldRow({
  isLast = false,
  label,
  value,
}: {
  readonly isLast?: boolean;
  readonly label: string;
  readonly value: string;
}) {
  const secondary = useThemeColor("secondary");
  const primary = useThemeColor("primary");

  return (
    <ListRowSurface variant="grouped" divider isLast={isLast} contentStyle={styles.fieldRow}>
      <View style={styles.fieldText}>
        <Text style={[styles.fieldLabel, { color: secondary }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: primary }]}>{value}</Text>
      </View>
    </ListRowSurface>
  );
}
