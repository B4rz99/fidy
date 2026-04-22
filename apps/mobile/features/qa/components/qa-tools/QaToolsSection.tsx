import type { ReactNode } from "react";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./QaTools.styles";

type QaToolsSectionProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function QaToolsSection({ title, children }: QaToolsSectionProps) {
  const primary = useThemeColor("primary");

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: primary }]}>{title}</Text>
      {children}
    </View>
  );
}
