import type { TextInputProps, ViewProps } from "react-native";
import { Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { FieldSurface } from "./FieldSurface";

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

  return (
    <View {...viewProps} className={className} style={style}>
      <Text className="mb-1 font-poppins-medium text-caption" style={{ color: secondary }}>
        {label}
      </Text>
      <FieldSurface size="button" contentStyle={{ paddingHorizontal: 0 }}>
        <TextInput
          className="h-10 flex-1 px-3 font-poppins-medium text-body"
          style={{ backgroundColor: "transparent", color: primary }}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          accessible
          accessibilityLabel={label || placeholder || value}
          placeholder={placeholder}
          placeholderTextColor={secondary}
        />
      </FieldSurface>
    </View>
  );
}

export type { FilterTextFieldProps };
