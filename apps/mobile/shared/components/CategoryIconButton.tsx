import * as Haptics from "expo-haptics";
import type { PressableProps, StyleProp, TextStyle, ViewStyle } from "react-native";
import {
  DARK_CATEGORY_BACKGROUND_COLOR,
  getCategoryBarBackgroundColor,
  type Category,
} from "@/shared/categories";
import { useColorScheme, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import { Pressable, StyleSheet, Text } from "./rn";

type CategoryIconButtonVariant = "strip" | "filter" | "bar";

type CategoryIconButtonProps = Omit<PressableProps, "children" | "style"> & {
  readonly backgroundColor?: string;
  readonly category: Category | null;
  readonly dimmed?: boolean;
  readonly haptics?: boolean;
  readonly iconStyle?: StyleProp<TextStyle>;
  readonly idleColor?: string;
  readonly selected?: boolean;
  readonly selectedColor?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly variant?: CategoryIconButtonVariant;
};

export function CategoryIconButton({
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  backgroundColor,
  category,
  dimmed = false,
  haptics = true,
  iconStyle,
  idleColor,
  onPress,
  selected = false,
  selectedColor,
  style,
  variant = "strip",
  ...pressableProps
}: CategoryIconButtonProps) {
  const { locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const surfaceMuted = useThemeColor("surfaceMuted");
  const isDark = useColorScheme() === "dark";
  const defaultIdleColor =
    variant === "strip" && isDark ? DARK_CATEGORY_BACKGROUND_COLOR : surfaceMuted;
  const defaultSelectedColor = category
    ? getCategoryBarBackgroundColor(category.id, category.color ?? accentGreen)
    : accentGreen;
  const resolvedBackgroundColor =
    backgroundColor ??
    (selected ? (selectedColor ?? defaultSelectedColor) : (idleColor ?? defaultIdleColor));
  const resolvedAccessibilityLabel =
    accessibilityLabel ?? (category ? getCategoryLabel(category, locale) : undefined);

  const handlePress: PressableProps["onPress"] = (event) => {
    if (haptics) void Haptics.selectionAsync();
    onPress?.(event);
  };

  return (
    <Pressable
      {...pressableProps}
      accessibilityLabel={resolvedAccessibilityLabel}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityState={{ ...accessibilityState, selected }}
      onPress={handlePress}
      style={[
        styles.base,
        variant === "filter" ? styles.filter : variant === "bar" ? styles.bar : styles.strip,
        selected ? (variant === "bar" ? styles.barSelected : styles.selected) : null,
        {
          backgroundColor: resolvedBackgroundColor,
          opacity: dimmed ? (variant === "filter" ? 0.34 : 0.42) : 1,
          transform: [{ scale: selected ? 1.08 : 1 }],
        },
        style,
      ]}
    >
      <Text
        style={[
          variant === "filter"
            ? styles.filterIcon
            : variant === "bar"
              ? styles.barIcon
              : styles.stripIcon,
          selected && variant === "filter" ? styles.filterIconSelected : null,
          selected && variant === "bar" ? styles.barIconSelected : null,
          iconStyle,
        ]}
      >
        {category?.icon ?? ""}
      </Text>
    </Pressable>
  );
}

export type { CategoryIconButtonProps, CategoryIconButtonVariant };

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  strip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  filter: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  bar: {
    flex: 1,
    width: "100%",
    maxWidth: 44,
    minHeight: 24,
    justifyContent: "flex-start",
    borderRadius: 8,
    borderCurve: "continuous",
    paddingTop: 7,
  },
  selected: {
    boxShadow: "0 3px 6px rgba(0, 0, 0, 0.18)",
  },
  barSelected: {
    boxShadow: "0 3px 6px rgba(0, 0, 0, 0.22)",
  },
  stripIcon: {
    fontSize: 20,
  },
  filterIcon: {
    fontSize: 20,
  },
  filterIconSelected: {
    fontSize: 22,
  },
  barIcon: {
    fontSize: 16,
  },
  barIconSelected: {
    fontSize: 18,
  },
});
