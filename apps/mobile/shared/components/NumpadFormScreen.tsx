import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FidyNumpad } from "@/shared/components/FidyNumpad";
import { Keyboard, Pressable, StyleSheet, View } from "@/shared/components/rn";
import { ScreenShell } from "./ScreenShell";
import { SolidScreenHeader } from "./SolidScreenHeader";

type NumpadFormScreenProps = {
  readonly children?: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly middle?: ReactNode;
  readonly middleStyle?: StyleProp<ViewStyle>;
  readonly footer?: ReactNode;
  readonly footerStyle?: StyleProp<ViewStyle>;
  readonly headerTitle?: string;
  readonly numpadVisible?: boolean;
  readonly onBack?: () => void;
  readonly onKeyPress: (key: string) => void;
  readonly reserveHiddenNumpadSpace?: boolean;
};

export function NumpadFormScreen({
  children,
  contentStyle,
  middle,
  middleStyle,
  footer,
  footerStyle,
  headerTitle,
  numpadVisible = true,
  onBack,
  onKeyPress,
  reserveHiddenNumpadSpace = true,
}: NumpadFormScreenProps) {
  const { bottom, top } = useSafeAreaInsets();
  const hasHeader = headerTitle != null || onBack != null;

  return (
    <ScreenShell>
      <View style={styles.shell}>
        {hasHeader ? <SolidScreenHeader title={headerTitle} onBack={onBack} /> : null}
        <Pressable accessible={false} style={styles.shell} onPress={Keyboard.dismiss}>
          <View
            style={[styles.contentShell, { paddingTop: hasHeader ? 16 : top + 72 }, contentStyle]}
          >
            {children}
          </View>
          {middle ? <View style={[styles.middleShell, middleStyle]}>{middle}</View> : null}
          <View style={[styles.bottomShell, { paddingBottom: Math.max(bottom, 16) }, footerStyle]}>
            {footer}
            {numpadVisible ? (
              <FidyNumpad onKeyPress={onKeyPress} />
            ) : reserveHiddenNumpadSpace ? (
              <View
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                style={styles.hiddenNumpad}
              >
                <FidyNumpad onKeyPress={onKeyPress} />
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
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
    overflow: "visible",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hiddenNumpad: {
    opacity: 0,
  },
});
