import { Stack } from "expo-router";
import { Platform, useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";

export default function FinanceStackLayout() {
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "transparent" },
        headerTransparent: Platform.OS === "ios",
        headerShown: true,
        headerTitle: "",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "transparent" },
        headerTintColor: theme.primary,
      }}
    />
  );
}
