import type { FormTextFieldProps } from "./FormTextField";
import { Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { MoneyEntryFieldSurface } from "./MoneyEntryFieldSurface";

type MoneyEntryTextFieldProps = FormTextFieldProps;

export function MoneyEntryTextField({
  helperText,
  inputStyle,
  labelStyle,
  label,
  onChangeText,
  placeholder,
  ref,
  style,
  value,
  ...inputProps
}: MoneyEntryTextFieldProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");

  return (
    <View style={[{ gap: 4 }, style]}>
      <Text
        style={[
          {
            color: primary,
            fontFamily: "Poppins_600SemiBold",
            fontSize: 12,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>
      <MoneyEntryFieldSurface compact>
        <TextInput
          {...inputProps}
          ref={ref}
          accessible
          accessibilityLabel={label}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tertiary}
          style={[
            {
              backgroundColor: "transparent",
              borderWidth: 0,
              color: primary,
              flex: 1,
              fontFamily: "Poppins_500Medium",
              fontSize: 14,
              height: 44,
              padding: 0,
            },
            inputStyle,
          ]}
          value={value}
        />
      </MoneyEntryFieldSurface>
      {helperText ? (
        <Text
          style={{
            color: secondary,
            fontFamily: "Poppins_500Medium",
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

export type { MoneyEntryTextFieldProps };
