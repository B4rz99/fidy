import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { SurfacePressable } from "./SurfacePressable";
import { SolidSurface } from "./SolidSurface";

type SegmentedControlVariant = "grouped" | "detached";

type SegmentedControlOption<TValue extends string> = {
  readonly value: TValue;
  readonly label: string;
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
  readonly leading?: ReactNode;
};

type SegmentedControlProps<TValue extends string> = Omit<ViewProps, "children"> & {
  readonly options: readonly SegmentedControlOption<TValue>[];
  readonly value: TValue | null;
  readonly onChange: (value: TValue) => void;
  readonly allowReselect?: boolean;
  readonly variant?: SegmentedControlVariant;
  readonly style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  allowReselect = false,
  variant = "grouped",
  style,
  ...viewProps
}: SegmentedControlProps<TValue>) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  const optionNodes = options.map((option) => {
    const selected = option.value === value;
    const opacity = option.disabled ? 0.5 : value !== null && !selected ? 0.4 : 1;

    return (
      <SurfacePressable
        key={option.value}
        accessibilityLabel={option.accessibilityLabel ?? option.label}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: option.disabled }}
        disabled={option.disabled}
        onPress={() => {
          if (allowReselect || option.value !== value) {
            onChange(option.value);
          }
        }}
        padded={false}
        radius={999}
        style={[styles.optionShell, { opacity }]}
        surfaceLayoutStyle={styles.optionSurface}
      >
        {option.leading}
        <Text
          className="font-poppins-semibold text-label"
          numberOfLines={1}
          style={{ color: selected ? primary : secondary }}
        >
          {option.label}
        </Text>
      </SurfacePressable>
    );
  });

  if (variant === "detached") {
    return (
      <View {...viewProps} style={[styles.detachedContainer, style]}>
        {optionNodes}
      </View>
    );
  }

  return (
    <SolidSurface
      {...viewProps}
      padded={false}
      radius={999}
      style={[styles.groupedContainer, style]}
    >
      {optionNodes}
    </SolidSurface>
  );
}

export type { SegmentedControlOption, SegmentedControlProps, SegmentedControlVariant };

const styles = StyleSheet.create({
  groupedContainer: {
    flexDirection: "row",
    gap: 4,
    height: 40,
    padding: 3,
  },
  detachedContainer: {
    flexDirection: "row",
    gap: 8,
    height: 40,
  },
  optionShell: {
    flex: 1,
  },
  optionSurface: {
    alignItems: "center",
    borderRadius: 999,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
});
