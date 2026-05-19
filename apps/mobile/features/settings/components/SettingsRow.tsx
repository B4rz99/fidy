import type { LucideIcon } from "@/shared/components/icons";
import { ChevronRight } from "@/shared/components/icons";
import { Pressable, StyleSheet, Switch, Text, View } from "@/shared/components/rn";
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
  const borderColor = useThemeColor("borderSubtle");
  const iconColor = destructive ? accentRed : secondaryColor;
  const textColorClass = destructive
    ? "text-accent-red dark:text-accent-red-dark"
    : "text-primary dark:text-primary-dark";

  const content = (
    <View
      className="flex-row items-center"
      style={{
        minHeight: 56,
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: isLast ? "transparent" : borderColor,
      }}
    >
      <Icon size={24} color={iconColor} />
      <View className="flex-1" style={{ gap: 2 }}>
        <Text className={`font-poppins text-sm ${textColorClass}`}>{label}</Text>
        {subtitle ? (
          <Text className="font-poppins text-xs text-secondary dark:text-secondary-dark">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessory === "chevron" ? <ChevronRight size={18} color={tertiaryColor} /> : null}
      {accessory === "switch" ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ true: accentGreen }}
        />
      ) : null}
      {accessory === "text" && rightText ? (
        <Text className="font-poppins text-xs text-tertiary dark:text-tertiary-dark">
          {rightText}
        </Text>
      ) : null}
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
