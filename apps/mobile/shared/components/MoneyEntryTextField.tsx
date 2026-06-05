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
        className="font-poppins-semibold text-caption"
        style={[
          {
            color: primary,
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
          className="font-poppins-medium text-[14px]"
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
          className="font-poppins-medium text-caption leading-[18px]"
          style={{
            color: secondary,
          }}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

export type { MoneyEntryTextFieldProps };
