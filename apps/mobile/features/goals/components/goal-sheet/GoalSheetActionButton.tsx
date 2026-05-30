import { Button } from "@/shared/components";

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
  return (
    <Button
      label={label}
      variant={variant === "destructive" ? "danger" : "primary"}
      size="compact"
      onPress={onPress}
      disabled={disabled || busy}
      loading={busy}
    />
  );
}
