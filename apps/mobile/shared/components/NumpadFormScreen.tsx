import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAuroraBackground } from "@/shared/components/AppAuroraBackground";
import { FidyNumpad } from "@/shared/components/FidyNumpad";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "@/shared/components/rn";
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
    <Pressable
      accessible={false}
      style={[styles.shell, { backgroundColor: page }]}
      onPress={Keyboard.dismiss}
    >
      <AppAuroraBackground isDark={isDark} />
      <ScrollView
        style={styles.contentScroller}
        contentContainerStyle={[styles.contentShell, { paddingTop: top + 72 }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {middle ? <View style={[styles.middleShell, middleStyle]}>{middle}</View> : null}
      <View style={[styles.bottomShell, { paddingBottom: Math.max(bottom, 16) }, footerStyle]}>
        {footer}
        {numpadVisible ? <FidyNumpad onKeyPress={onKeyPress} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  contentScroller: {
    flex: 0,
  },
  contentShell: {
    gap: 12,
    paddingHorizontal: 16,
  },
  middleShell: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  bottomShell: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
