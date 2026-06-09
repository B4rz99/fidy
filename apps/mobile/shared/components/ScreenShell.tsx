import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "@/shared/components/rn";
import { useColorScheme, useThemeColor } from "@/shared/hooks";
import { AppAuroraBackground } from "./AppAuroraBackground";

type ScreenShellProps = {
  readonly backgroundColor?: string;
  readonly backgroundLayer?: ReactNode;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
};

export function ScreenShell({
  backgroundColor,
  backgroundLayer,
  children,
  style,
}: ScreenShellProps) {
  const isDark = useColorScheme() === "dark";
  const page = useThemeColor("page");

  return (
    <View style={[{ flex: 1, backgroundColor: backgroundColor ?? page }, style]}>
      <AppAuroraBackground isDark={isDark} />
      {backgroundLayer}
      {children}
    </View>
  );
}

export type { ScreenShellProps };
