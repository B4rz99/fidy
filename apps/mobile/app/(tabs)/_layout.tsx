import { Tabs } from "expo-router";
import { AddTransactionSheet } from "@/features/transactions/components/AddTransactionSheet";
import { useTransactionStore } from "@/features/transactions/store";
import { CustomTabBar } from "@/shared/components/navigation/CustomTabBar";

const ADD_TAB_PREFIX = "add-";

export default function TabsLayout() {
  const openSheet = useTransactionStore((s) => s.openSheet);
  const closeSheet = useTransactionStore((s) => s.closeSheet);

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <CustomTabBar {...props} />}
        screenListeners={{
          tabPress: (e) => {
            if (e.target?.startsWith(ADD_TAB_PREFIX)) {
              e.preventDefault();
              openSheet();
            } else if (useTransactionStore.getState().isOpen) {
              closeSheet();
            }
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="ai" options={{ title: "AI" }} />
        <Tabs.Screen name="add" options={{ title: "Add" }} />
        <Tabs.Screen name="wallet" options={{ title: "Wallet" }} />
        <Tabs.Screen name="menu" options={{ title: "Menu" }} />
      </Tabs>
      <AddTransactionSheet />
    </>
  );
}
