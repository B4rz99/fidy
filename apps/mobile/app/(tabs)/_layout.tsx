import { Tabs, useRouter } from "expo-router";
import { MenuPanel } from "@/features/menu/components/MenuPanel";
import { useMenuStore } from "@/features/menu/store";
import { CustomTabBar } from "@/shared/components/navigation/CustomTabBar";

const ADD_TAB_PREFIX = "add-";
const MENU_TAB_PREFIX = "menu-";

export default function TabsLayout() {
  const { push } = useRouter();
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
              if (useMenuStore.getState().isOpen) closeMenu();
              push("/add-transaction");
            } else if (e.target?.startsWith(MENU_TAB_PREFIX)) {
              e.preventDefault();
              openMenu();
            } else {
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
        <Tabs.Screen name="connected-accounts" options={{ href: null }} />
        <Tabs.Screen name="failed-emails" options={{ href: null }} />
      </Tabs>
      <MenuPanel />
    </>
  );
}
