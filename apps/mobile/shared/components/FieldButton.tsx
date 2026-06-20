import type { ReactNode } from "react";
import type { PressableProps, StyleProp, TextStyle, ViewProps, ViewStyle } from "react-native";
import { X, type LucideIcon } from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { FieldSurface } from "./FieldSurface";
import { IconActionButton } from "./IconActionButton";

type FieldButtonProps = Omit<ViewProps, "children"> & {
  readonly label?: string;
  readonly value: ReactNode;
  readonly placeholder?: string;
  readonly placeholderColor?: string;
  readonly leading?: ReactNode;
  readonly icon?: LucideIcon;
  readonly trailing?: ReactNode;
  readonly onPress: PressableProps["onPress"];
  readonly onClear?: PressableProps["onPress"];
  readonly borderColor?: string;
  readonly clearAccessibilityLabel?: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly labelStyle?: StyleProp<TextStyle>;
  readonly className?: string;
  readonly buttonStyle?: StyleProp<ViewStyle>;
  readonly surfaceBackgroundColor?: string;
  readonly surfaceRadius?: number;
  readonly valueStyle?: StyleProp<TextStyle>;
  readonly valueClassName?: string;
};

function getFieldButtonContentStyle(buttonStyle: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(buttonStyle);
  if (!flattened) return null;

  return {
    height: flattened.height,
    minHeight: flattened.minHeight,
    padding: flattened.padding,
    paddingBottom: flattened.paddingBottom,
    paddingHorizontal: flattened.paddingHorizontal,
    paddingLeft: flattened.paddingLeft,
    paddingRight: flattened.paddingRight,
    paddingTop: flattened.paddingTop,
    paddingVertical: flattened.paddingVertical,
  };
}

function getFieldButtonContainerStyle(buttonStyle: StyleProp<ViewStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(buttonStyle);
  if (!flattened) return null;

  return {
    alignSelf: flattened.alignSelf,
    flex: flattened.flex,
    margin: flattened.margin,
    marginBottom: flattened.marginBottom,
    marginHorizontal: flattened.marginHorizontal,
    marginLeft: flattened.marginLeft,
    marginRight: flattened.marginRight,
    marginTop: flattened.marginTop,
    marginVertical: flattened.marginVertical,
    width: flattened.width,
  };
}

export function FieldButton({
  label,
  value,
  placeholder,
  placeholderColor,
  leading,
  icon: Icon,
  trailing,
  onPress,
  onClear,
  clearAccessibilityLabel,
  active = false,
  disabled = false,
  labelStyle,
  className,
  buttonStyle,
  surfaceBackgroundColor,
  surfaceRadius,
  valueStyle,
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
  const contentStyle = getFieldButtonContentStyle(buttonStyle);
  const containerStyle = getFieldButtonContainerStyle(buttonStyle);
  const valueColor = value === "" && placeholder ? (placeholderColor ?? tertiary) : primary;
  const valueNode =
    typeof value === "string" ? (
      <Text
        className={`font-poppins-medium text-body ${
          value === "" && placeholder ? "text-text-tertiary dark:text-text-tertiary-dark" : ""
        } ${valueClassName ?? ""}`}
        style={[{ color: valueColor }, valueStyle]}
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
        <Text
          className="mb-1 font-poppins-medium text-caption"
          style={[{ color: secondary }, labelStyle]}
        >
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
          backgroundColor={surfaceBackgroundColor}
          size="button"
          radius={surfaceRadius ?? 8}
          style={containerStyle}
          contentStyle={contentStyle}
        >
          {leading}
          {Icon ? <Icon size={18} color={secondary} /> : null}
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
