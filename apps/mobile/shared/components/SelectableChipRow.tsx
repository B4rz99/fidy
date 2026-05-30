import type { ReactNode } from "react";
import type { ViewProps } from "react-native";
import { View } from "@/shared/components/rn";
import { Chip } from "./Chip";

type SelectableChipRowTone = "neutral" | "primary" | "success" | "danger" | "warning";

type SelectableChipOption<TValue extends string> = {
  readonly value: TValue;
  readonly label: string;
  readonly accessibilityLabel?: string;
  readonly leading?: ReactNode;
  readonly disabled?: boolean;
};

type SelectableChipRowProps<TValue extends string> = Omit<ViewProps, "children"> & {
  readonly options: readonly SelectableChipOption<TValue>[];
  readonly value: TValue | null;
  readonly onChange: (value: TValue) => void;
  readonly selectedTone?: SelectableChipRowTone;
  readonly unselectedTone?: SelectableChipRowTone;
  readonly className?: string;
  readonly chipClassName?: string;
  readonly getOptionTestID?: (value: TValue) => string;
};

export function SelectableChipRow<TValue extends string>({
  options,
  value,
  onChange,
  selectedTone = "success",
  unselectedTone = "neutral",
  className,
  chipClassName,
  getOptionTestID,
  style,
  ...viewProps
}: SelectableChipRowProps<TValue>) {
  return (
    <View {...viewProps} className={`flex-row ${className ?? ""}`} style={[{ gap: 8 }, style]}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Chip
            key={option.value}
            label={option.label}
            leading={option.leading}
            selected={selected}
            tone={selected ? selectedTone : unselectedTone}
            onPress={() => {
              if (!option.disabled && option.value !== value) {
                onChange(option.value);
              }
            }}
            testID={getOptionTestID?.(option.value)}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected, disabled: option.disabled }}
            className={`${chipClassName ?? ""} ${option.disabled ? "opacity-50" : ""}`}
          />
        );
      })}
    </View>
  );
}

export type { SelectableChipOption, SelectableChipRowProps, SelectableChipRowTone };
