import { useState, type ComponentProps, type ComponentRef, type Ref } from "react";
import type { LucideIcon } from "@/shared/components/icons";
import type { StyleProp, TextStyle, ViewProps } from "@/shared/components/rn";
import { Animated, StyleSheet, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { FieldSurface } from "./FieldSurface";
import {
  getFieldContainerStyle,
  getFieldContentStyle,
  getTextInputContentStyle,
  getTextInputSizingStyle,
} from "./text-field-style";
import { useAnimatedPlaceholderOpacity } from "./use-animated-placeholder-opacity";

type RNTextInput = ComponentRef<typeof TextInput>;
type TextInputProps = ComponentProps<typeof TextInput>;

type FormTextFieldProps = Omit<ViewProps, "children"> &
  Omit<
    TextInputProps,
    "accessibilityLabel" | "onChangeText" | "placeholder" | "style" | "value"
  > & {
    readonly label: string;
    readonly value: string;
    readonly onChangeText: TextInputProps["onChangeText"];
    readonly helperText?: string | null;
    readonly icon?: LucideIcon;
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
  icon: Icon,
  inputStyle,
  labelStyle,
  placeholder,
  ref,
  className,
  style,
  ...inputProps
}: FormTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const fieldContainerStyle = getFieldContainerStyle(inputStyle);
  const fieldContentStyle = getFieldContentStyle(inputStyle);
  const textInputSizingStyle = getTextInputSizingStyle(inputStyle);
  const textInputContentStyle = getTextInputContentStyle(inputStyle);
  const placeholderOpacity = useAnimatedPlaceholderOpacity(
    !isFocused && value.length === 0 && placeholder != null
  );

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
      <FieldSurface contentStyle={fieldContentStyle} style={fieldContainerStyle}>
        {Icon ? <Icon size={18} color={secondary} /> : null}
        <View style={styles.inputWrap}>
          {placeholder ? (
            <Animated.Text
              pointerEvents="none"
              style={[
                styles.formPlaceholder,
                { color: tertiary, opacity: placeholderOpacity },
                textInputContentStyle,
                textInputSizingStyle,
              ]}
            >
              {placeholder}
            </Animated.Text>
          ) : null}
          <TextInput
            {...inputProps}
            ref={ref}
            accessible
            accessibilityLabel={label}
            onChangeText={onChangeText}
            onBlur={(event) => {
              setIsFocused(false);
              inputProps.onBlur?.(event);
            }}
            onFocus={(event) => {
              setIsFocused(true);
              inputProps.onFocus?.(event);
            }}
            placeholder={undefined}
            placeholderTextColor={tertiary}
            style={[
              {
                flex: 1,
                minHeight: 50,
                paddingHorizontal: 0,
                fontFamily: "Poppins_800ExtraBold",
                fontSize: 15,
                color: primary,
              },
              textInputContentStyle,
              textInputSizingStyle,
              { backgroundColor: "transparent", borderWidth: 0 },
            ]}
            value={value}
          />
        </View>
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

const styles = StyleSheet.create({
  formPlaceholder: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 15,
    left: 0,
    minHeight: 50,
    paddingVertical: 0,
    position: "absolute",
    right: 0,
    textAlignVertical: "center",
    top: 0,
  },
  inputWrap: {
    flex: 1,
    position: "relative",
  },
});
