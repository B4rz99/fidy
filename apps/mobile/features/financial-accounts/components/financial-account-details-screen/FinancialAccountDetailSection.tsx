import type { ReactNode } from "react";
import { GlassSurface } from "@/shared/components";
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
      <GlassSurface padded={false} radius={18} style={styles.card}>
        {children}
      </GlassSurface>
    </View>
  );
}

export function FinancialAccountFieldRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  const secondary = useThemeColor("secondary");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View style={[styles.fieldRow, { borderBottomColor: borderSubtle }]}>
      <Text style={[styles.fieldLabel, { color: secondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: primary }]}>{value}</Text>
    </View>
  );
}
