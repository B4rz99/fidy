import { Stack } from "expo-router";
import { Platform } from "@/shared/components/rn";

export default function FinanceStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "transparent" },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "transparent" },
        headerTransparent: Platform.OS === "ios",
        title: "",
      }}
    />
  );
}
