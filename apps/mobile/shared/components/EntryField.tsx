import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { Animated, Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./EntryScaffold.styles";
import { MoneyEntryFieldSurface } from "./MoneyEntryFieldSurface";
import { useAnimatedPlaceholderOpacity } from "./use-animated-placeholder-opacity";

export type EntryFieldProps = {
  readonly icon: ComponentType<{ size?: number; color?: string }>;
  readonly label: string;
  readonly selected?: boolean;
  readonly selectedColor?: string;
  readonly value?: string;
  readonly valueTone?: "primary" | "secondary" | "tertiary";
  readonly onPress?: () => void;
  readonly children?: ReactNode;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
};

function getToneColor(input: {
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly value?: string;
  readonly valueTone?: EntryFieldProps["valueTone"];
}): string {
  if (input.valueTone === "primary") return input.primary;
  if (input.valueTone === "secondary") return input.secondary;
  if (input.valueTone === "tertiary") return input.tertiary;
  if (input.value) return input.primary;
  return input.tertiary;
}

export function EntryField({
  children,
  icon: Icon,
  label,
  onPress,
  selected = false,
  selectedColor,
  testID,
  value,
  valueTone,
}: EntryFieldProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const toneColor = getToneColor({ primary, secondary, tertiary, value, valueTone });
  const selectionColor = selectedColor ?? accentGreen;
  const content = children ?? (
    <Text
      numberOfLines={1}
      style={[styles.fieldText, { color: toneColor }]}
    >{`${label}${value ? ` ${value}` : ""}`}</Text>
  );
  const surface = (
    <MoneyEntryFieldSurface
      testID={onPress ? undefined : testID}
      style={{
        borderRadius: 14,
      }}
    >
      <Icon size={18} color={selected ? selectionColor : secondary} />
      {content}
    </MoneyEntryFieldSurface>
  );

  if (!onPress) {
    return surface;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ flex: 1 }}
    >
      {surface}
    </Pressable>
  );
}

export function EntryTextInputField(props: {
  readonly icon: EntryFieldProps["icon"];
  readonly label: string;
  readonly onChangeText: (text: string) => void;
  readonly value: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");
  const placeholderOpacity = useAnimatedPlaceholderOpacity(!isFocused && props.value.length === 0);

  return (
    <EntryField icon={props.icon} label={props.label}>
      <View style={styles.inputWrap}>
        <Animated.Text
          pointerEvents="none"
          style={[styles.fieldPlaceholder, { color: tertiary, opacity: placeholderOpacity }]}
        >
          {props.label}
        </Animated.Text>
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          onBlur={() => setIsFocused(false)}
          onFocus={() => setIsFocused(true)}
          placeholder={undefined}
          placeholderTextColor={tertiary}
          maxLength={200}
          style={[styles.fieldInput, { color: primary }]}
        />
      </View>
    </EntryField>
  );
}
