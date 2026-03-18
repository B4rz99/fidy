import { Tabs, useRouter } from "expo-router";
import { CustomTabBar } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

const ADD_TAB_PREFIX = "add-";

export default function TabsLayout() {
  const { push } = useRouter();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
      screenListeners={{
        tabPress: (e) => {
          if (e.target?.startsWith(ADD_TAB_PREFIX)) {
            e.preventDefault();
            push("/add-transaction");
          }
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="ai" options={{ title: t("tabs.ai") }} />
      <Tabs.Screen name="add" options={{ title: t("tabs.add") }} />
      <Tabs.Screen name="calendar" options={{ title: t("tabs.calendar") }} />
      <Tabs.Screen name="menu" options={{ title: t("tabs.settings") }} />
      <Tabs.Screen name="connected-accounts" options={{ href: null }} />
      <Tabs.Screen name="failed-emails" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
