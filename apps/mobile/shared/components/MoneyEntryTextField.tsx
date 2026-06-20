import type { LucideIcon } from "./icons";
import type { FormTextFieldProps } from "./FormTextField";
import { useState } from "react";
import { Animated, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { MoneyEntryFieldSurface } from "./MoneyEntryFieldSurface";
import { getTextInputContentStyle, getTextInputSizingStyle } from "./text-field-style";
import { useAnimatedPlaceholderOpacity } from "./use-animated-placeholder-opacity";

type MoneyEntryTextFieldProps = FormTextFieldProps & {
  readonly icon?: LucideIcon;
};

export function MoneyEntryTextField({
  helperText,
  icon: Icon,
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
  const [isFocused, setIsFocused] = useState(false);
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const textInputContentStyle = getTextInputContentStyle(inputStyle);
  const textInputSizingStyle = getTextInputSizingStyle(inputStyle);
  const placeholderOpacity = useAnimatedPlaceholderOpacity(
    !isFocused && value.length === 0 && placeholder != null
  );

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
        {Icon ? <Icon size={18} color={secondary} /> : null}
        <View style={{ flex: 1, position: "relative" }}>
          {placeholder ? (
            <Animated.Text
              pointerEvents="none"
              style={[
                {
                  color: tertiary,
                  fontFamily: "Poppins_500Medium",
                  fontSize: 14,
                  height: 44,
                  left: 0,
                  lineHeight: 44,
                  opacity: placeholderOpacity,
                  position: "absolute",
                  right: 0,
                  top: 0,
                },
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
            className="font-poppins-medium text-[14px]"
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
                backgroundColor: "transparent",
                borderWidth: 0,
                color: primary,
                flex: 1,
                height: 44,
                padding: 0,
              },
              textInputContentStyle,
              textInputSizingStyle,
            ]}
            value={value}
          />
        </View>
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
