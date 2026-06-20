import type { ReactNode } from "react";
import type { StyleProp, TextInputProps, TextStyle, ViewProps } from "react-native";
import { StyleSheet, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { FieldSurface } from "./FieldSurface";

type FilterTextFieldProps = Omit<ViewProps, "children"> & {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: TextInputProps["onChangeText"];
  readonly placeholder?: string;
  readonly keyboardType?: TextInputProps["keyboardType"];
  readonly inputStyle?: StyleProp<TextStyle>;
  readonly labelStyle?: StyleProp<TextStyle>;
  readonly leading?: ReactNode;
  readonly surfaceBackgroundColor?: string;
};

export function FilterTextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  inputStyle,
  labelStyle,
  leading,
  surfaceBackgroundColor,
  className,
  style,
  ...viewProps
}: FilterTextFieldProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  return (
    <View {...viewProps} className={className} style={style}>
      <Text
        className="mb-1 font-poppins-medium text-caption"
        style={[{ color: secondary }, labelStyle]}
      >
        {label}
      </Text>
      <FieldSurface
        backgroundColor={surfaceBackgroundColor}
        size="button"
        radius={10}
        contentStyle={styles.content}
      >
        {leading}
        <View style={styles.inputWrap}>
          <TextInput
            className="h-10 flex-1 font-poppins-medium text-body"
            style={[styles.input, { color: primary }, inputStyle]}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            accessible
            accessibilityLabel={label || placeholder || value}
            placeholder={placeholder}
            placeholderTextColor={secondary}
          />
        </View>
      </FieldSurface>
    </View>
  );
}

export type { FilterTextFieldProps };

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingHorizontal: 12,
  },
  input: {
    backgroundColor: "transparent",
  },
  inputWrap: {
    flex: 1,
  },
});
