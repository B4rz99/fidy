import { Tabs, useRouter } from "expo-router";
import { MenuPanel, useMenuStore } from "@/features/menu";
import { CustomTabBar } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

const ADD_TAB_PREFIX = "add-";
const MENU_TAB_PREFIX = "menu-";

export default function TabsLayout() {
  const { push } = useRouter();
  const { t } = useTranslation();
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
        <Tabs.Screen name="index" options={{ title: t("tabs.home") }} />
        <Tabs.Screen name="ai" options={{ title: t("tabs.ai") }} />
        <Tabs.Screen name="add" options={{ title: t("tabs.add") }} />
        <Tabs.Screen name="calendar" options={{ title: t("tabs.calendar") }} />
        <Tabs.Screen name="menu" options={{ title: t("tabs.menu") }} />
        <Tabs.Screen name="connected-accounts" options={{ href: null }} />
        <Tabs.Screen name="failed-emails" options={{ href: null }} />
      </Tabs>
      <MenuPanel />
    </>
  );
}
