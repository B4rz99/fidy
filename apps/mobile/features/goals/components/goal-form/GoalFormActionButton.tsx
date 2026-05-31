import { Button } from "@/shared/components";

type GoalFormActionButtonProps = {
  readonly busy?: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: "destructive" | "primary";
};

export function GoalFormActionButton({
  busy = false,
  disabled = false,
  label,
  onPress,
  variant = "primary",
}: GoalFormActionButtonProps) {
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
