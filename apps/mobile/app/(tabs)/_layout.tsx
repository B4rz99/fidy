import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="transactions" options={{ title: "Transactions" }} />
    </Tabs>
  );
}
