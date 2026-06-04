import { X } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { FieldButtonProps } from "./FieldButton";
import { IconActionButton } from "./IconActionButton";
import { MoneyEntryFieldSurface } from "./MoneyEntryFieldSurface";

type MoneyEntryDateButtonProps = Omit<FieldButtonProps, "value"> & {
  readonly value: string;
};

export function MoneyEntryDateButton({
  active: _active,
  accessibilityHint,
  accessibilityLabel,
  accessibilityState,
  accessible,
  buttonStyle,
  className,
  clearAccessibilityLabel,
  disabled = false,
  importantForAccessibility,
  label,
  leading: _leading,
  onClear,
  onPress,
  placeholder,
  style,
  testID,
  trailing: _trailing,
  valueClassName,
  value,
  ...viewProps
}: MoneyEntryDateButtonProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const isPlaceholder = value === "" && placeholder != null;

  return (
    <View {...viewProps} className={className} style={[{ gap: 4 }, style]}>
      {label ? (
        <Text className="font-poppins-medium text-caption" style={{ color: secondary }}>
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ ...accessibilityState, disabled }}
        accessible={accessible}
        importantForAccessibility={importantForAccessibility}
        testID={testID}
        className={disabled ? "opacity-60" : ""}
      >
        <MoneyEntryFieldSurface compact style={buttonStyle}>
          <Text
            className={`font-poppins-medium text-body ${valueClassName ?? ""}`}
            style={{ color: isPlaceholder ? tertiary : primary }}
          >
            {isPlaceholder ? placeholder : value}
          </Text>
          <View className="flex-1" />
          {onClear ? (
            <IconActionButton
              accessibilityLabel={clearAccessibilityLabel ?? t("common.clear")}
              icon={<X size={14} color={tertiary} />}
              onPress={(event) => {
                event.stopPropagation?.();
                onClear(event);
              }}
              size="size-7"
            />
          ) : null}
        </MoneyEntryFieldSurface>
      </Pressable>
    </View>
  );
}

export type { MoneyEntryDateButtonProps };
