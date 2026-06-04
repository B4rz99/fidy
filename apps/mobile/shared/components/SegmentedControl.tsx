import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { Pressable, StyleSheet, Text } from "@/shared/components/rn";
import { useColorScheme, useThemeColor } from "@/shared/hooks";
import { getSubtleGlassCardTokens } from "./card-tokens";
import { GlassSurface } from "./GlassSurface";

type SegmentedControlTone = "primary" | "success" | "danger";

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
  readonly className?: string;
};

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  tone = "primary",
  getOptionTone,
  allowReselect = false,
  className,
  ...viewProps
}: SegmentedControlProps<TValue>) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const tokens = getSubtleGlassCardTokens(isDark);
  const primary = useThemeColor("primary");
  const success = useThemeColor("success");
  const danger = useThemeColor("danger");
  const secondary = useThemeColor("secondary");
  const toneColors: Record<SegmentedControlTone, string> = {
    primary,
    success,
    danger,
  };

  return (
    <GlassSurface
      {...viewProps}
      className={className}
      padded={false}
      radius={999}
      style={[styles.container, viewProps.style]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const activeTone = getOptionTone?.(option.value) ?? tone;
        const activeColor = toneColors[activeTone];

        return (
          <Pressable
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
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-full px-3 ${
              option.disabled ? "opacity-50" : ""
            }`}
            style={
              selected
                ? [
                    styles.selectedOption,
                    { backgroundColor: tokens.tintColor, borderColor: activeColor },
                  ]
                : styles.option
            }
          >
            {option.leading}
            <Text
              className="font-poppins-semibold text-label"
              numberOfLines={1}
              style={{ color: selected ? activeColor : secondary }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

export type { SegmentedControlOption, SegmentedControlProps, SegmentedControlTone };

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    height: 40,
    padding: 3,
  },
  option: {
    borderColor: "transparent",
    borderWidth: 1,
  },
  selectedOption: {
    borderWidth: 1,
  },
});
