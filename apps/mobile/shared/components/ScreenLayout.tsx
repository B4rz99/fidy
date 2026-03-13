import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

export const TAB_BAR_CLEARANCE = 96;
export const HEADER_HEIGHT = 48;

type ScreenLayoutProps = {
  title: string;
  variant?: "tab" | "sub";
  rightActions?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
};

export function ScreenLayout({
  title,
  variant = "tab",
  rightActions,
  onBack,
  children,
}: ScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const primaryColor = useThemeColor("primary");
  const isTab = variant === "tab";

  return (
    <View className="flex-1 bg-page dark:bg-page-dark">
      <View style={{ paddingTop: process.env.EXPO_OS === "web" ? 0 : insets.top }}>
        <View className="px-4 flex-row items-center justify-between h-12">
          <View className="flex-row items-center" style={{ gap: 12 }}>
            {!isTab && (
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
              {title}
            </Text>
          </View>
          {rightActions}
        </View>
      </View>
      <View className="flex-1">{children}</View>
    </View>
  );
}
