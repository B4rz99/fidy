import { Stack } from "expo-router";
import { Platform, useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";

export default function FinanceStackLayout() {
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <Stack
      screenOptions={{
        headerShown: Platform.OS === "ios",
        headerStyle: { backgroundColor: theme.page },
        headerTintColor: theme.primary,
      }}
    />
  );
}
