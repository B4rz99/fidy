import { GlassPressable } from "@/shared/components/GlassPressable";
import { ChevronRight } from "@/shared/components/icons";
import { Text } from "@/shared/components/rn";
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
    <GlassPressable
      onPress={onPress}
      radius={14}
      padded={false}
      surfaceLayoutStyle={styles.manageButton}
    >
      <Text style={[styles.manageButtonText, { color: primary }]}>{label}</Text>
      <ChevronRight size={16} color={secondary} />
    </GlassPressable>
  );
}
