import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { SurfacePressable } from "./SurfacePressable";
import { SolidSurface } from "./SolidSurface";
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
    minHeight: flattened.minHeight,
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
  onPress,
  radius = 18,
  selected = false,
  selectedBorderColor: _selectedBorderColor,
  layoutStyle,
  testID,
  variant = "standalone",
  ...viewProps
}: ListRowSurfaceProps) {
  const dividerBaseColor = useThemeColor("borderStrong");
  const dividerColor = dividerColorOverride ?? dividerBaseColor;
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
  const shouldShowDivider = divider && !isLast;
  const contentStyleValue = [
    styles.content,
    {
      minHeight,
      opacity: disabled ? 0.5 : 1,
    },
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
        style={[contentStyleValue, outerLayoutStyle, rowLayoutStyle]}
      >
        {children}
        {shouldShowDivider ? (
          <View
            pointerEvents="none"
            style={[styles.groupedDivider, { backgroundColor: dividerColor }]}
          />
        ) : null}
      </View>
    ) : (
      <SolidSurface
        {...viewProps}
        {...surfaceA11yProps}
        padded={false}
        radius={radius}
        className={className}
        style={surfaceLayoutStyle}
      >
        <View
          style={[
            styles.content,
            {
              minHeight,
              opacity: disabled ? 0.5 : 1,
            },
            rowLayoutStyle,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </SolidSurface>
    );

  if (onPress == null) return content;

  if (variant === "standalone") {
    return (
      <SurfacePressable
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
        radius={radius}
        surfaceClassName={className}
        surfaceLayoutStyle={surfaceLayoutStyle}
      >
        <View
          style={[
            styles.content,
            {
              minHeight,
              opacity: disabled ? 0.5 : 1,
            },
            rowLayoutStyle,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </SurfacePressable>
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
  groupedDivider: {
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    left: 14,
    position: "absolute",
    right: 14,
  },
});

export type { ListRowSurfaceProps, ListRowSurfaceVariant };
