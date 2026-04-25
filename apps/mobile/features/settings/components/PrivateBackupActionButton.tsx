import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type BackupActionButtonProps = {
  readonly label: string;
  readonly onPress: () => void | Promise<void>;
  readonly variant?: "primary" | "secondary" | "danger";
  readonly disabled?: boolean;
};

const getButtonTextClassName = (isPrimary: boolean, isDanger: boolean) =>
  isPrimary
    ? "font-poppins-semibold text-white"
    : isDanger
      ? "font-poppins-semibold text-accent-red dark:text-accent-red-dark"
      : "font-poppins-semibold text-primary dark:text-primary-dark";

export function BackupActionButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: BackupActionButtonProps) {
  const borderColor = useThemeColor("borderSubtle");
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={
        isPrimary
          ? "bg-accent-green rounded-2xl items-center justify-center"
          : "bg-card dark:bg-card-dark rounded-2xl items-center justify-center"
      }
      style={{
        height: 52,
        borderWidth: isPrimary ? 0 : 1,
        borderColor,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text
        className={getButtonTextClassName(isPrimary, variant === "danger")}
        style={{ fontSize: 13 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
