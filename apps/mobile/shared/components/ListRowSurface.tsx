import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";
import { GlassSurface } from "./GlassSurface";
import type { SurfaceLayoutStyle } from "./surface-style";

type ListRowSurfaceVariant = "grouped" | "standalone";

type ListRowSurfaceProps = Omit<ViewProps, "children" | "style"> & {
  readonly children: ReactNode;
  readonly className?: string;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly disabled?: boolean;
  readonly divider?: boolean;
  readonly dividerColor?: string;
  readonly isLast?: boolean;
  readonly layoutStyle?: SurfaceLayoutStyle;
  readonly minHeight?: number;
  readonly nativeGlass?: boolean;
  readonly onPress?: PressableProps["onPress"];
  readonly radius?: number;
  readonly selected?: boolean;
  readonly selectedBorderColor?: string;
  readonly variant?: ListRowSurfaceVariant;
};

function getSurfaceLayoutStyle(style: SurfaceLayoutStyle): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return null;

  return {
    alignSelf: flattened.alignSelf,
    aspectRatio: flattened.aspectRatio,
    bottom: flattened.bottom,
    display: flattened.display,
    end: flattened.end,
    flex: flattened.flex,
    flexBasis: flattened.flexBasis,
    flexGrow: flattened.flexGrow,
    flexShrink: flattened.flexShrink,
    height: flattened.height,
    left: flattened.left,
    margin: flattened.margin,
    marginBottom: flattened.marginBottom,
    marginEnd: flattened.marginEnd,
    marginHorizontal: flattened.marginHorizontal,
    marginLeft: flattened.marginLeft,
    marginRight: flattened.marginRight,
    marginStart: flattened.marginStart,
    marginTop: flattened.marginTop,
    marginVertical: flattened.marginVertical,
    maxHeight: flattened.maxHeight,
    maxWidth: flattened.maxWidth,
    minHeight: flattened.minHeight,
    minWidth: flattened.minWidth,
    position: flattened.position,
    right: flattened.right,
    start: flattened.start,
    top: flattened.top,
    width: flattened.width,
    zIndex: flattened.zIndex,
  };
}

function getRowContentLayoutStyle(style: SurfaceLayoutStyle): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(style);
  if (!flattened) return null;

  return {
    alignContent: flattened.alignContent,
    alignItems: flattened.alignItems,
    columnGap: flattened.columnGap,
    flexDirection: flattened.flexDirection,
    flexWrap: flattened.flexWrap,
    gap: flattened.gap,
    justifyContent: flattened.justifyContent,
    padding: flattened.padding,
    paddingBottom: flattened.paddingBottom,
    paddingEnd: flattened.paddingEnd,
    paddingHorizontal: flattened.paddingHorizontal,
    paddingLeft: flattened.paddingLeft,
    paddingRight: flattened.paddingRight,
    paddingStart: flattened.paddingStart,
    paddingTop: flattened.paddingTop,
    paddingVertical: flattened.paddingVertical,
    rowGap: flattened.rowGap,
  };
}

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
  dividerColor: dividerColorOverride,
  importantForAccessibility,
  isLast = false,
  minHeight = 56,
  nativeGlass = true,
  onPress,
  radius = 18,
  selected = false,
  selectedBorderColor,
  layoutStyle,
  testID,
  variant = "standalone",
  ...viewProps
}: ListRowSurfaceProps) {
  const borderColor = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const selectedColor = selectedBorderColor ?? accentGreen;
  const dividerColor = dividerColorOverride ?? borderColor;
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
  const outerLayoutStyle = getSurfaceLayoutStyle(layoutStyle);
  const rowLayoutStyle = getRowContentLayoutStyle(layoutStyle);
  const contentStyleValue = [
    styles.content,
    {
      minHeight,
      opacity: disabled ? 0.5 : 1,
    },
    variant === "grouped"
      ? {
          borderBottomColor: divider && !isLast ? dividerColor : "transparent",
          borderBottomWidth: divider && !isLast ? StyleSheet.hairlineWidth : 0,
        }
      : null,
    contentStyle,
  ];
  const surfaceLayoutStyle = [
    {
      minHeight,
    },
    outerLayoutStyle,
  ];

  const content =
    variant === "grouped" ? (
      <View
        {...viewProps}
        {...surfaceA11yProps}
        className={className}
        style={[contentStyleValue, layoutStyle]}
      >
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
        style={surfaceLayoutStyle}
      >
        <View
          style={[
            styles.content,
            {
              opacity: disabled ? 0.5 : 1,
            },
            rowLayoutStyle,
            contentStyle,
          ]}
        >
          {children}
        </View>
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
        surfaceLayoutStyle={surfaceLayoutStyle}
      >
        <View
          style={[
            styles.content,
            {
              opacity: disabled ? 0.5 : 1,
            },
            rowLayoutStyle,
            contentStyle,
          ]}
        >
          {children}
        </View>
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
