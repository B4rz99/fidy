import type { Ref } from "react";
import type {
  StyleProp,
  TextInput as RNTextInput,
  TextInputProps,
  TextStyle,
  ViewProps,
} from "react-native";
import { Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { FieldSurface } from "./FieldSurface";

type FormTextFieldProps = Omit<ViewProps, "children"> &
  Omit<
    TextInputProps,
    "accessibilityLabel" | "onChangeText" | "placeholder" | "style" | "value"
  > & {
    readonly label: string;
    readonly value: string;
    readonly onChangeText: TextInputProps["onChangeText"];
    readonly helperText?: string | null;
    readonly inputStyle?: StyleProp<TextStyle>;
    readonly labelStyle?: StyleProp<TextStyle>;
    readonly placeholder?: string;
    readonly ref?: Ref<RNTextInput>;
  };

export function FormTextField({
  label,
  value,
  onChangeText,
  helperText,
  inputStyle,
  labelStyle,
  placeholder,
  ref,
  className,
  style,
  ...inputProps
}: FormTextFieldProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");

  return (
    <View className={className} style={[{ gap: 6 }, style]}>
      <Text
        style={[
          {
            color: secondary,
            fontFamily: "Poppins_800ExtraBold",
            fontSize: 12,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>
      <FieldSurface contentStyle={{ paddingHorizontal: 0 }}>
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
              minHeight: 50,
              paddingHorizontal: 14,
              fontFamily: "Poppins_800ExtraBold",
              fontSize: 15,
              backgroundColor: "transparent",
              color: primary,
            },
            inputStyle,
            { backgroundColor: "transparent", borderWidth: 0 },
          ]}
          value={value}
        />
      </FieldSurface>
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

export type { FormTextFieldProps };
