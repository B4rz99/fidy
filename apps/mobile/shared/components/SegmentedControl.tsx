import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { Pressable, Text, View } from "@/shared/components/rn";

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
  readonly className?: string;
};

const ACTIVE_CLASS_NAMES: Record<SegmentedControlTone, string> = {
  primary: "bg-action-primary dark:bg-action-primary-dark",
  success: "bg-success dark:bg-success-dark",
  danger: "bg-danger dark:bg-danger-dark",
};

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  tone = "primary",
  getOptionTone,
  className,
  ...viewProps
}: SegmentedControlProps<TValue>) {
  return (
    <View
      {...viewProps}
      className={`h-10 flex-row rounded-full bg-surface-muted p-[3px] dark:bg-surface-muted-dark ${
        className ?? ""
      }`}
      style={[{ gap: 4 }, viewProps.style]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const activeTone = getOptionTone?.(option.value) ?? tone;

        return (
          <Pressable
            key={option.value}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: option.disabled }}
            disabled={option.disabled}
            onPress={() => {
              if (option.value !== value) {
                onChange(option.value);
              }
            }}
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-full px-3 ${
              selected ? ACTIVE_CLASS_NAMES[activeTone] : ""
            } ${option.disabled ? "opacity-50" : ""}`}
          >
            {option.leading}
            <Text
              className={`font-poppins-semibold text-label ${
                selected
                  ? "text-text-on-accent dark:text-text-on-accent-dark"
                  : "text-text-secondary dark:text-text-secondary-dark"
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type { SegmentedControlOption, SegmentedControlProps, SegmentedControlTone };
