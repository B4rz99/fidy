import type { FormTextFieldProps } from "./FormTextField";
import { FormTextField } from "./FormTextField";
import { useThemeColor } from "@/shared/hooks";

type MoneyEntryTextFieldProps = FormTextFieldProps;

export function MoneyEntryTextField({
  inputStyle,
  labelStyle,
  style,
  ...fieldProps
}: MoneyEntryTextFieldProps) {
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <FormTextField
      {...fieldProps}
      style={[{ gap: 4 }, style]}
      labelStyle={[
        {
          color: primary,
          fontFamily: "Poppins_600SemiBold",
          fontSize: 12,
        },
        labelStyle,
      ]}
      inputStyle={[
        {
          height: 44,
          borderRadius: 10,
          borderCurve: "continuous",
          borderWidth: 1,
          paddingHorizontal: 14,
          backgroundColor: card,
          borderColor: borderSubtle,
          color: primary,
          fontFamily: "Poppins_500Medium",
          fontSize: 14,
        },
        inputStyle,
      ]}
    />
  );
}

export type { MoneyEntryTextFieldProps };
