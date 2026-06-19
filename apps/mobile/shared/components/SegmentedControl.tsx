import type { ReactNode } from "react";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";
import { GlassSurface } from "./GlassSurface";

type SegmentedControlTone = "primary" | "success" | "danger";
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
  readonly tone?: SegmentedControlTone;
  readonly getOptionTone?: (value: TValue) => SegmentedControlTone;
  readonly allowReselect?: boolean;
  readonly variant?: SegmentedControlVariant;
  readonly style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  tone = "primary",
  getOptionTone,
  allowReselect = false,
  variant = "grouped",
  style,
  ...viewProps
}: SegmentedControlProps<TValue>) {
  const accentGreen = useThemeColor("accentGreen");
  const success = useThemeColor("success");
  const danger = useThemeColor("danger");
  const secondary = useThemeColor("secondary");
  const toneColors: Record<SegmentedControlTone, string> = {
    primary: accentGreen,
    success,
    danger,
  };

  const optionNodes = options.map((option) => {
    const selected = option.value === value;
    const activeTone = getOptionTone?.(option.value) ?? tone;
    const activeColor = toneColors[activeTone];

    return (
      <GlassPressable
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
        style={[styles.optionShell, option.disabled ? styles.disabledOption : null]}
        surfaceLayoutStyle={styles.optionSurface}
      >
        {option.leading}
        <Text
          className="font-poppins-semibold text-label"
          numberOfLines={1}
          style={{ color: selected ? activeColor : secondary }}
        >
          {option.label}
        </Text>
      </GlassPressable>
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
    <GlassSurface
      {...viewProps}
      padded={false}
      radius={999}
      style={[styles.groupedContainer, style]}
    >
      {optionNodes}
    </GlassSurface>
  );
}

export type {
  SegmentedControlOption,
  SegmentedControlProps,
  SegmentedControlTone,
  SegmentedControlVariant,
};

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
  disabledOption: {
    opacity: 0.5,
  },
});
