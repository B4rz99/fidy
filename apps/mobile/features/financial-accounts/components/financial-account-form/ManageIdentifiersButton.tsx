import { ChevronRight } from "@/shared/components/icons";
import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";

export function ManageIdentifiersButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  return (
    <Pressable style={styles.manageButton} onPress={onPress}>
      <Text style={[styles.manageButtonText, { color: primary }]}>{label}</Text>
      <ChevronRight size={16} color={secondary} />
    </Pressable>
  );
}
