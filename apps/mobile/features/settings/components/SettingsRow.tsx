import type { LucideIcon } from "@/shared/components/icons";
import { ChevronRight } from "@/shared/components/icons";
import { Row } from "@/shared/components";
import { Switch, Text } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type SettingsRowProps = {
  icon: LucideIcon;
  label: string;
  subtitle?: string;
  accessory?: "chevron" | "switch" | "text" | "none";
  rightText?: string;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  onPress?: () => void;
  destructive?: boolean;
  isLast?: boolean;
};

export function SettingsRow({
  icon: Icon,
  label,
  subtitle,
  accessory = "chevron",
  rightText,
  switchValue,
  onSwitchChange,
  onPress,
  destructive = false,
  isLast = false,
}: SettingsRowProps) {
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const iconColor = destructive ? accentRed : secondaryColor;

  const trailing =
    accessory === "chevron" ? (
      <ChevronRight size={18} color={tertiaryColor} />
    ) : accessory === "switch" ? (
      <Switch
        value={switchValue ?? false}
        onValueChange={onSwitchChange}
        trackColor={{ true: accentGreen }}
      />
    ) : accessory === "text" && rightText ? (
      <Text className="font-poppins text-xs text-tertiary dark:text-tertiary-dark">
        {rightText}
      </Text>
    ) : null;

  return (
    <Row
      title={label}
      subtitle={subtitle}
      leading={<Icon size={24} color={iconColor} />}
      trailing={trailing}
      onPress={onPress}
      destructive={destructive}
      isLast={isLast}
      titleClassName="text-sm"
      subtitleClassName="text-xs"
    />
  );
}
