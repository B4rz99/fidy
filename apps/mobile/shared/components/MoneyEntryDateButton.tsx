import type { FieldButtonProps } from "./FieldButton";
import { FieldButton } from "./FieldButton";

type MoneyEntryDateButtonProps = Omit<FieldButtonProps, "value"> & {
  readonly value: string;
};

export function MoneyEntryDateButton({
  buttonStyle,
  className,
  style,
  valueClassName,
  ...fieldProps
}: MoneyEntryDateButtonProps) {
  return (
    <FieldButton
      {...fieldProps}
      className={className}
      style={[{ gap: 4 }, style]}
      buttonStyle={[
        {
          minHeight: 44,
          borderRadius: 10,
          paddingHorizontal: 14,
        },
        buttonStyle,
      ]}
      valueClassName={valueClassName}
    />
  );
}

export type { MoneyEntryDateButtonProps };
