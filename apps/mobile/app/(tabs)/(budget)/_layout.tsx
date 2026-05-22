import { Stack } from "expo-router";

export default function BudgetStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "transparent" },
        headerShown: false,
      }}
    />
  );
}
