import type { TextInputProps, ViewProps } from "react-native";
import { Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type FilterTextFieldProps = Omit<ViewProps, "children"> & {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: TextInputProps["onChangeText"];
  readonly placeholder?: string;
  readonly keyboardType?: TextInputProps["keyboardType"];
};

export function FilterTextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  className,
  style,
  ...viewProps
}: FilterTextFieldProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const peachLight = useThemeColor("peachLight");

  return (
    <View {...viewProps} className={className} style={style}>
      <Text className="mb-1 font-poppins-medium text-caption" style={{ color: secondary }}>
        {label}
      </Text>
      <TextInput
        className="h-10 rounded-lg px-3 font-poppins-medium text-body"
        style={{ backgroundColor: peachLight, color: primary }}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        accessible
        accessibilityLabel={label || placeholder || value}
        placeholder={placeholder}
        placeholderTextColor={secondary}
      />
    </View>
  );
}

export type { FilterTextFieldProps };
