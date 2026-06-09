import type { ReactNode } from "react";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { Check } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { ListRowSurface } from "./ListRowSurface";

type PickerOptionRowProps = {
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly trailing?: ReactNode;
  readonly selected?: boolean;
  readonly onPress: PressableProps["onPress"];
  readonly accessibilityHint?: string;
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID?: string;
};

export function PickerOptionRow({
  accessibilityHint,
  accessibilityLabel,
  leading,
  onPress,
  selected = false,
  style,
  subtitle,
  testID,
  title,
  trailing,
}: PickerOptionRowProps) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const titleNode =
    typeof title === "string" ? (
      <Text style={[styles.title, { color: primary }]} numberOfLines={1}>
        {title}
      </Text>
    ) : (
      title
    );
  const subtitleNode =
    typeof subtitle === "string" ? (
      <Text style={[styles.subtitle, { color: secondary }]} numberOfLines={1}>
        {subtitle}
      </Text>
    ) : (
      subtitle
    );

  return (
    <ListRowSurface
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      selected={selected}
      selectedBorderColor={accentGreen}
      minHeight={52}
      radius={18}
      layoutStyle={style}
    >
      {leading}
      <View style={styles.textWrap}>
        {titleNode}
        {subtitleNode}
      </View>
      {trailing ?? (selected ? <Check size={18} color={accentGreen} strokeWidth={3} /> : null)}
    </ListRowSurface>
  );
}

const styles = StyleSheet.create({
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});

export type { PickerOptionRowProps };
