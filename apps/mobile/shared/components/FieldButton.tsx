import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { X } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { FieldSurface } from "./FieldSurface";
import { IconActionButton } from "./IconActionButton";

type FieldButtonProps = Omit<ViewProps, "children"> & {
  readonly label?: string;
  readonly value: ReactNode;
  readonly placeholder?: string;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onPress: PressableProps["onPress"];
  readonly onClear?: PressableProps["onPress"];
  readonly clearAccessibilityLabel?: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly buttonStyle?: StyleProp<ViewStyle>;
  readonly valueClassName?: string;
};

export function FieldButton({
  label,
  value,
  placeholder,
  leading,
  trailing,
  onPress,
  onClear,
  clearAccessibilityLabel,
  active = false,
  disabled = false,
  className,
  buttonStyle,
  valueClassName,
  style,
  accessibilityHint,
  accessibilityLabel,
  accessibilityState,
  accessible,
  importantForAccessibility,
  testID,
  ...viewProps
}: FieldButtonProps) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const valueNode =
    typeof value === "string" ? (
      <Text
        className={`font-poppins-medium text-body ${
          value === "" && placeholder ? "text-text-tertiary dark:text-text-tertiary-dark" : ""
        } ${valueClassName ?? ""}`}
        style={{ color: value === "" && placeholder ? tertiary : primary }}
      >
        {value === "" && placeholder ? placeholder : value}
      </Text>
    ) : (
      value
    );

  const handleClear: PressableProps["onPress"] | undefined = onClear
    ? (event) => {
        event.stopPropagation?.();
        onClear(event);
      }
    : undefined;

  return (
    <View {...viewProps} className={className} style={style}>
      {label ? (
        <Text className="mb-1 font-poppins-medium text-caption" style={{ color: secondary }}>
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ ...accessibilityState, disabled, selected: active }}
        accessible={accessible}
        importantForAccessibility={importantForAccessibility}
        testID={testID}
        className={`${disabled ? "opacity-60" : ""}`}
        style={{ minHeight: 40 }}
      >
        <FieldSurface
          size="button"
          radius={8}
          style={buttonStyle}
          surfaceStyle={active ? { borderColor: primary } : null}
        >
          {leading}
          <View className="flex-1">{valueNode}</View>
          {handleClear ? (
            <IconActionButton
              accessibilityLabel={clearAccessibilityLabel ?? t("common.clear")}
              icon={<X size={14} color={tertiary} />}
              onPress={handleClear}
              size="size-7"
            />
          ) : (
            trailing
          )}
        </FieldSurface>
      </Pressable>
    </View>
  );
}

export type { FieldButtonProps };
