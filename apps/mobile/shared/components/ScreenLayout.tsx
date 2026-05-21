import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "@/shared/components/icons";
import { Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

export const TAB_BAR_CLEARANCE = Platform.OS === "ios" ? 0 : 96;
export const HEADER_HEIGHT = 48;

type ScreenLayoutProps = {
  title: string;
  variant?: "tab" | "sub";
  backgroundColor?: string;
  backgroundLayer?: ReactNode;
  leftAction?: ReactNode;
  rightActions?: ReactNode;
  onBack?: () => void;
  includesNativeHeader?: boolean;
  children: ReactNode;
};

export function ScreenLayout({
  title,
  variant = "tab",
  backgroundColor,
  backgroundLayer,
  leftAction,
  rightActions,
  onBack,
  includesNativeHeader = true,
  children,
}: ScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const primaryColor = useThemeColor("primary");
  const isTab = variant === "tab";
  const customHeaderTopInset = process.env.EXPO_OS === "web" ? 0 : insets.top;
  const shouldRenderRightSlot = rightActions != null || (isTab && leftAction != null);
  const rightSlotClassName = isTab ? "flex-1 flex-row justify-end" : "flex-row justify-end";
  const shouldRenderCustomHeader =
    Platform.OS !== "ios" ||
    (!includesNativeHeader &&
      (!isTab || leftAction != null || rightActions != null || onBack != null));
  const iosHeaderOptions = {
    title: isTab ? "" : title,
    ...(rightActions != null && {
      headerRight: () => rightActions,
    }),
    ...(onBack != null && {
      headerLeft: () => (
        <Pressable onPress={onBack} hitSlop={12}>
          <ChevronLeft size={24} color={primaryColor} />
        </Pressable>
      ),
    }),
  };

  return (
    <View className="flex-1 bg-page dark:bg-page-dark" style={{ backgroundColor }}>
      {backgroundLayer}
      {Platform.OS === "ios" && includesNativeHeader && <Stack.Screen options={iosHeaderOptions} />}
      {shouldRenderCustomHeader && (
        <View style={{ paddingTop: customHeaderTopInset }}>
          <View className="px-4 flex-row items-center justify-between h-12">
            <View className="flex-1 flex-row items-center" style={{ gap: 12 }}>
              {leftAction}
              {!isTab && onBack != null && (
                <Pressable onPress={onBack} hitSlop={12}>
                  <ChevronLeft size={24} color={primaryColor} />
                </Pressable>
              )}
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
            </View>
            {isTab && leftAction != null ? (
              <Text
                className="absolute left-0 right-0 text-center font-poppins-extrabold text-logo text-primary dark:text-primary-dark"
                pointerEvents="none"
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : null}
            {shouldRenderRightSlot ? (
              <View className={rightSlotClassName}>{rightActions}</View>
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
    </View>
  );
}
