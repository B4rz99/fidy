import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FidyNumpad } from "@/shared/components/FidyNumpad";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "@/shared/components/rn";
import { ScreenShell } from "./ScreenShell";

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
  const { bottom, top } = useSafeAreaInsets();

  return (
    <ScreenShell>
      <Pressable accessible={false} style={styles.shell} onPress={Keyboard.dismiss}>
        <View style={[styles.contentShell, { paddingTop: top + 72 }, contentStyle]}>
          {children}
        </View>
        {middle ? <View style={[styles.middleShell, middleStyle]}>{middle}</View> : null}
        <View style={[styles.bottomShell, { paddingBottom: Math.max(bottom, 16) }, footerStyle]}>
          {footer ? (
            <ScrollView
              style={styles.footerScroller}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {footer}
            </ScrollView>
          ) : null}
          {numpadVisible ? <FidyNumpad onKeyPress={onKeyPress} /> : null}
        </View>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
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
  footerScroller: {
    flexGrow: 0,
    flexShrink: 1,
  },
});
