import { Tabs } from "expo-router";
import { MenuPanel } from "@/features/menu/components/MenuPanel";
import { useMenuStore } from "@/features/menu/store";
import { AddTransactionSheet } from "@/features/transactions/components/AddTransactionSheet";
import { useTransactionStore } from "@/features/transactions/store";
import { CustomTabBar } from "@/shared/components/navigation/CustomTabBar";

const ADD_TAB_PREFIX = "add-";
const MENU_TAB_PREFIX = "menu-";

export default function TabsLayout() {
  const openSheet = useTransactionStore((s) => s.openSheet);
  const closeSheet = useTransactionStore((s) => s.closeSheet);
  const openMenu = useMenuStore((s) => s.openMenu);
  const closeMenu = useMenuStore((s) => s.closeMenu);

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
            } else if (e.target?.startsWith(MENU_TAB_PREFIX)) {
              e.preventDefault();
              openMenu();
            } else {
              if (useTransactionStore.getState().isOpen) closeSheet();
              if (useMenuStore.getState().isOpen) closeMenu();
            }
          },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="ai" options={{ title: "AI" }} />
        <Tabs.Screen name="add" options={{ title: "Add" }} />
        <Tabs.Screen name="goals" options={{ title: "Goals" }} />
        <Tabs.Screen name="menu" options={{ title: "Menu" }} />
        <Tabs.Screen name="calendar" options={{ href: null }} />
      </Tabs>
      <AddTransactionSheet />
      <MenuPanel />
    </>
  );
}
