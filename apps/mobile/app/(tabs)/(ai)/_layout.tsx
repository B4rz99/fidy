import { Stack } from "expo-router";

export default function AiStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "transparent" },
        headerShown: false,
      }}
    />
  );
}
