import type { Ref } from "react";
import type {
  StyleProp,
  TextInput as RNTextInput,
  TextInputProps,
  TextStyle,
  ViewProps,
  ViewStyle,
} from "react-native";
import { StyleSheet, Text, TextInput, View } from "@/shared/components/rn";
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

function getFieldSurfaceStyle(inputStyle: StyleProp<TextStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(inputStyle);
  if (!flattened) return null;

  return {
    backgroundColor: flattened.backgroundColor,
    borderColor: flattened.borderColor,
    borderRadius: flattened.borderRadius,
    borderWidth: flattened.borderWidth,
  };
}

function getFieldContainerStyle(inputStyle: StyleProp<TextStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(inputStyle);
  if (!flattened) return null;

  return {
    height: flattened.height,
    minHeight: flattened.minHeight,
  };
}

function getFieldContentStyle(inputStyle: StyleProp<TextStyle>): StyleProp<ViewStyle> {
  const flattened = StyleSheet.flatten(inputStyle);
  if (!flattened) return { paddingHorizontal: 0 };

  return {
    height: flattened.height,
    minHeight: flattened.minHeight ?? flattened.height,
    paddingHorizontal: 0,
  };
}

function getTextInputSizingStyle(inputStyle: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flattened = StyleSheet.flatten(inputStyle);
  if (!flattened?.height) return null;

  return {
    minHeight: flattened.height,
  };
}

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
  const fieldSurfaceStyle = getFieldSurfaceStyle(inputStyle);
  const fieldContainerStyle = getFieldContainerStyle(inputStyle);
  const fieldContentStyle = getFieldContentStyle(inputStyle);
  const textInputSizingStyle = getTextInputSizingStyle(inputStyle);

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
      <FieldSurface
        contentStyle={fieldContentStyle}
        style={fieldContainerStyle}
        surfaceStyle={fieldSurfaceStyle}
      >
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
              flex: 1,
              minHeight: 50,
              paddingHorizontal: 14,
              fontFamily: "Poppins_800ExtraBold",
              fontSize: 15,
              color: primary,
            },
            inputStyle,
            textInputSizingStyle,
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
