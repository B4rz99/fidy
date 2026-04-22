import type { ReactNode } from "react";
import { FidyNumpad } from "@/shared/components";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./GoalSheet.styles";

type GoalSheetFrameProps = {
  readonly children: ReactNode;
  readonly numpadEnabled: boolean;
  readonly onKeyPress: (key: string) => void;
  readonly title: string;
};

export function GoalSheetFrame({
  children,
  numpadEnabled,
  onKeyPress,
  title,
}: GoalSheetFrameProps) {
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const primary = useThemeColor("primary");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: card }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.grabBar, { backgroundColor: borderSubtle }]} />
      <Text style={[styles.title, { color: primary }]}>{title}</Text>
      {children}
      {numpadEnabled ? <FidyNumpad onKeyPress={onKeyPress} /> : null}
    </ScrollView>
  );
}
