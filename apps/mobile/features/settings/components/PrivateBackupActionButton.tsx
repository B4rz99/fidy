import { Button } from "@/shared/components";

type BackupActionButtonProps = {
  readonly label: string;
  readonly onPress: () => void | Promise<void>;
  readonly variant?: "primary" | "secondary" | "danger";
  readonly disabled?: boolean;
};

export function BackupActionButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: BackupActionButtonProps) {
  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      variant={
        variant === "primary" ? "primary" : variant === "danger" ? "dangerSecondary" : "secondary"
      }
      className="rounded-2xl"
    />
  );
}
