import { Stack } from "expo-router";
import { useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";

export default function FinanceStackLayout() {
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: "",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "transparent" },
        headerTintColor: theme.primary,
      }}
    />
  );
}
