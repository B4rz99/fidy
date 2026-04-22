import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./GoalSheet.styles";

type GoalSheetActionButtonProps = {
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: "destructive" | "primary";
};

export function GoalSheetActionButton({
  busy = false,
  disabled = false,
  label,
  onPress,
  variant = "primary",
}: GoalSheetActionButtonProps) {
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  return (
    <Pressable
      style={[
        styles.actionButton,
        variant === "primary"
          ? { backgroundColor: accentGreen, opacity: busy ? 0.5 : 1 }
          : [styles.destructiveActionButton, { borderColor: accentRed, opacity: busy ? 0.5 : 1 }],
      ]}
      onPress={onPress}
      disabled={disabled || busy}
    >
      <Text
        style={[
          variant === "primary" ? styles.actionButtonText : styles.destructiveActionButtonText,
          variant === "destructive" ? { color: accentRed } : undefined,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
