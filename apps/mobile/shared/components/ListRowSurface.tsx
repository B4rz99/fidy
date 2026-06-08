import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";
import { GlassSurface } from "./GlassSurface";

type ListRowSurfaceVariant = "grouped" | "standalone";

type ListRowSurfaceProps = Omit<ViewProps, "children"> & {
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly disabled?: boolean;
  readonly divider?: boolean;
  readonly isLast?: boolean;
  readonly minHeight?: number;
  readonly nativeGlass?: boolean;
  readonly onPress?: PressableProps["onPress"];
  readonly radius?: number;
  readonly selected?: boolean;
  readonly selectedBorderColor?: string;
  readonly variant?: ListRowSurfaceVariant;
};

export function ListRowSurface({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  accessible,
  children,
  className,
  contentStyle,
  disabled = false,
  divider = false,
  importantForAccessibility,
  isLast = false,
  minHeight = 56,
  nativeGlass = true,
  onPress,
  radius = 18,
  selected = false,
  selectedBorderColor,
  style,
  testID,
  variant = "standalone",
  ...viewProps
}: ListRowSurfaceProps) {
  const borderColor = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const selectedColor = selectedBorderColor ?? accentGreen;
  const surfaceA11yProps =
    onPress == null
      ? {
          accessible,
          accessibilityHint,
          accessibilityLabel,
          accessibilityRole,
          accessibilityState: { ...accessibilityState, disabled, selected },
          importantForAccessibility,
          testID,
        }
      : null;
  const innerStyle = [
    styles.content,
    {
      minHeight,
      opacity: disabled ? 0.5 : 1,
    },
    variant === "grouped"
      ? {
          borderBottomColor: divider && !isLast ? borderColor : "transparent",
          borderBottomWidth: divider && !isLast ? StyleSheet.hairlineWidth : 0,
        }
      : null,
    contentStyle,
  ];

  const content =
    variant === "grouped" ? (
      <View {...viewProps} {...surfaceA11yProps} className={className} style={[innerStyle, style]}>
        {children}
      </View>
    ) : (
      <GlassSurface
        {...viewProps}
        {...surfaceA11yProps}
        nativeGlass={nativeGlass}
        padded={false}
        radius={radius}
        borderColor={selected ? selectedColor : undefined}
        className={className}
        style={[innerStyle, style]}
      >
        {children}
      </GlassSurface>
    );

  if (onPress == null) return content;

  if (variant === "standalone") {
    return (
      <GlassPressable
        {...viewProps}
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        disabledOpacity={1}
        accessible={accessible}
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole ?? "button"}
        accessibilityState={{ ...accessibilityState, disabled, selected }}
        importantForAccessibility={importantForAccessibility}
        nativeGlass={nativeGlass}
        radius={radius}
        borderColor={selected ? selectedColor : undefined}
        surfaceClassName={className}
        surfaceStyle={[innerStyle, style]}
      >
        {children}
      </GlassPressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessible={accessible}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={{ ...accessibilityState, disabled, selected }}
      importantForAccessibility={importantForAccessibility}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});

export type { ListRowSurfaceProps, ListRowSurfaceVariant };
