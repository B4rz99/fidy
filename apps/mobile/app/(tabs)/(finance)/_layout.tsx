import { Stack } from "expo-router";

export default function FinanceStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "transparent" },
        headerShown: false,
        headerShadowVisible: false,
        title: "",
      }}
    />
  );
}
