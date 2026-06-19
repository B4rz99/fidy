import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, Text, View } from "@/shared/components/rn";
import { HeaderBackButton } from "./HeaderBackButton";
import { ScreenShell } from "./ScreenShell";

export const TAB_BAR_CLEARANCE = Platform.OS === "ios" ? 0 : 96;
export const HEADER_HEIGHT = 48;

type ScreenLayoutProps = {
  title?: string;
  variant?: "tab" | "sub";
  backgroundColor?: string;
  backgroundLayer?: ReactNode;
  centerAction?: ReactNode;
  leftAction?: ReactNode;
  rightActions?: ReactNode;
  onBack?: () => void;
  includesNativeHeader?: boolean;
  children: ReactNode;
};

export function ScreenLayout({
  title = "",
  variant = "tab",
  backgroundColor,
  backgroundLayer,
  centerAction,
  leftAction,
  rightActions,
  onBack,
  includesNativeHeader = false,
  children,
}: ScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const isTab = variant === "tab";
  const customHeaderTopInset = process.env.EXPO_OS === "web" ? 0 : insets.top;
  const shouldRenderRightSlot = rightActions != null || (isTab && leftAction != null);
  const rightSlotClassName = isTab ? "flex-1 flex-row justify-end" : "flex-row justify-end";
  const shouldRenderCenterAction = centerAction != null;
  const shouldRenderCustomHeader =
    Platform.OS !== "ios" ||
    (!includesNativeHeader &&
      (!isTab || centerAction != null || leftAction != null || rightActions != null));
  const shouldShowIosNativeHeader = !isTab || centerAction != null || rightActions != null;
  const iosHeaderOptions = {
    contentStyle: { backgroundColor: "transparent" },
    headerShadowVisible: false,
    headerShown: shouldShowIosNativeHeader,
    headerStyle: { backgroundColor: "transparent" },
    headerTransparent: true,
    headerBackVisible: false,
    headerBackButtonDisplayMode: "minimal" as const,
    headerBackTitle: "",
    title: isTab ? "" : title,
    ...(centerAction != null && {
      headerTitle: () => centerAction,
    }),
    ...(rightActions != null && {
      headerRight: () => rightActions,
    }),
    ...(!isTab && {
      headerLeft: () => <HeaderBackButton onPress={onBack} />,
    }),
  };

  return (
    <ScreenShell backgroundColor={backgroundColor} backgroundLayer={backgroundLayer}>
      {Platform.OS === "ios" && includesNativeHeader && <Stack.Screen options={iosHeaderOptions} />}
      {Platform.OS === "ios" && !includesNativeHeader && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      {shouldRenderCustomHeader && (
        <View style={{ paddingTop: customHeaderTopInset }}>
          <View className="px-4 flex-row items-center justify-between h-12">
            <View className="flex-1 flex-row items-center" style={{ gap: 12 }}>
              {leftAction}
              {!isTab && <HeaderBackButton onPress={onBack} />}
              {!shouldRenderCenterAction ? (
                <Text
                  className={
                    isTab
                      ? "font-poppins-extrabold text-logo text-primary dark:text-primary-dark"
                      : "font-poppins-bold text-title text-primary dark:text-primary-dark"
                  }
                  numberOfLines={1}
                >
                  {isTab ? "" : title}
                </Text>
              ) : null}
            </View>
            {shouldRenderCenterAction ? (
              <View
                className="absolute left-0 right-0 items-center"
                pointerEvents="box-none"
                style={styles.centerActionSlot}
              >
                {centerAction}
              </View>
            ) : null}
            {isTab && leftAction != null && centerAction == null ? (
              <Text
                className="absolute left-0 right-0 text-center font-poppins-extrabold text-logo text-primary dark:text-primary-dark"
                pointerEvents="none"
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : null}
            {shouldRenderRightSlot ? (
              <View className={rightSlotClassName} pointerEvents="box-none">
                {rightActions}
              </View>
            ) : null}
          </View>
        </View>
      )}
      <View
        className="flex-1"
        style={{
          paddingTop:
            Platform.OS === "ios" && !includesNativeHeader && !shouldRenderCustomHeader
              ? insets.top
              : 0,
        }}
      >
        {children}
      </View>
    </ScreenShell>
  );
}

const styles = {
  // Header center content is reserved for compact controls; side actions should stay icon-sized.
  centerActionSlot: {
    paddingHorizontal: 64,
  },
};
