import { Tabs } from "expo-router";
import { CustomTabBar } from "@/shared/components/navigation/CustomTabBar";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="ai" options={{ title: "AI" }} />
      <Tabs.Screen name="add" options={{ title: "Add" }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
      <Tabs.Screen name="menu" options={{ title: "Menu" }} />
    </Tabs>
  );
}
