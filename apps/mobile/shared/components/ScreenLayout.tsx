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
  rightActions?: ReactNode;
  onBack?: () => void;
  includesNativeHeader?: boolean;
  children: ReactNode;
};

export function ScreenLayout({
  title,
  variant = "tab",
  rightActions,
  onBack,
  includesNativeHeader = true,
  children,
}: ScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const primaryColor = useThemeColor("primary");
  const isTab = variant === "tab";
  const customHeaderTopInset = process.env.EXPO_OS === "web" ? 0 : insets.top;
  const shouldRenderCustomHeader =
    Platform.OS !== "ios" || (!includesNativeHeader && (rightActions != null || onBack != null));
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
    <View className="flex-1 bg-page dark:bg-page-dark">
      {Platform.OS === "ios" && includesNativeHeader && <Stack.Screen options={iosHeaderOptions} />}
      {shouldRenderCustomHeader && (
        <View style={{ paddingTop: customHeaderTopInset }}>
          <View className="px-4 flex-row items-center justify-between h-12">
            <View className="flex-row items-center" style={{ gap: 12 }}>
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
            {rightActions}
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
