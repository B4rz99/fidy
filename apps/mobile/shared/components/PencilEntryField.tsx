import type { ComponentType, ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./PencilEntryScaffold.styles";

export type PencilEntryFieldProps = {
  readonly icon: ComponentType<{ size?: number; color?: string }>;
  readonly label: string;
  readonly value?: string;
  readonly valueTone?: "primary" | "secondary" | "tertiary";
  readonly onPress?: () => void;
  readonly children?: ReactNode;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
};

export function PencilEntryField({
  children,
  icon: Icon,
  label,
  onPress,
  testID,
  value,
  valueTone,
}: PencilEntryFieldProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");
  const card = useThemeColor("card");
  const toneColor =
    valueTone === "primary"
      ? primary
      : valueTone === "secondary"
        ? secondary
        : valueTone === "tertiary"
          ? tertiary
          : value
            ? primary
            : tertiary;
  const content = children ?? (
    <Text
      numberOfLines={1}
      style={[styles.fieldText, { color: toneColor }]}
    >{`${label}${value ? ` ${value}` : ""}`}</Text>
  );
  const fieldStyle = [styles.fieldCard, { backgroundColor: card, borderColor: borderSubtle }];

  if (!onPress) {
    return (
      <View testID={testID} style={fieldStyle}>
        <Icon size={18} color={secondary} />
        {content}
      </View>
    );
  }

  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={fieldStyle}>
      <Icon size={18} color={secondary} />
      {content}
    </Pressable>
  );
}

export function PencilEntryTextInputField(props: {
  readonly icon: PencilEntryFieldProps["icon"];
  readonly label: string;
  readonly onChangeText: (text: string) => void;
  readonly value: string;
}) {
  const primary = useThemeColor("primary");
  const tertiary = useThemeColor("tertiary");

  return (
    <PencilEntryField icon={props.icon} label={props.label}>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.label}
        placeholderTextColor={tertiary}
        maxLength={200}
        style={[styles.fieldInput, { color: primary }]}
      />
    </PencilEntryField>
  );
}
