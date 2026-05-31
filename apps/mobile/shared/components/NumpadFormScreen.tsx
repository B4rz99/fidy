import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAuroraBackground } from "@/shared/components/AppAuroraBackground";
import { FidyNumpad } from "@/shared/components/FidyNumpad";
import { Keyboard, Platform, Pressable, StyleSheet, View } from "@/shared/components/rn";
import { useColorScheme, useThemeColor } from "@/shared/hooks";

type NumpadFormScreenProps = {
  readonly children?: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly middle?: ReactNode;
  readonly middleStyle?: StyleProp<ViewStyle>;
  readonly footer?: ReactNode;
  readonly footerStyle?: StyleProp<ViewStyle>;
  readonly numpadVisible?: boolean;
  readonly onKeyPress: (key: string) => void;
};

export function NumpadFormScreen({
  children,
  contentStyle,
  middle,
  middleStyle,
  footer,
  footerStyle,
  numpadVisible = true,
  onKeyPress,
}: NumpadFormScreenProps) {
  const page = useThemeColor("page");
  const isDark = useColorScheme() === "dark";
  const { bottom, top } = useSafeAreaInsets();

  return (
    <Pressable style={[styles.shell, { backgroundColor: page }]} onPress={Keyboard.dismiss}>
      <AppAuroraBackground isDark={isDark} />
      <View style={[styles.contentShell, { paddingTop: top + 72 }, contentStyle]}>{children}</View>
      {middle ? <View style={[styles.middleShell, middleStyle]}>{middle}</View> : null}
      <View
        style={[
          styles.bottomShell,
          { paddingBottom: Platform.OS === "ios" ? bottom : 16 },
          footerStyle,
        ]}
      >
        {footer}
        {numpadVisible ? <FidyNumpad onKeyPress={onKeyPress} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: "space-between",
  },
  contentShell: {
    gap: 12,
    paddingHorizontal: 16,
  },
  middleShell: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  bottomShell: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
