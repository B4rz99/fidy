import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { CustomTabBar } from "@/shared/components";
import { Platform } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";

function IosTabs() {
  const { t } = useTranslation();

  return (
    <NativeTabs tintColor="#7CB243" sidebarAdaptable>
      <NativeTabs.Trigger name="(index)">
        <NativeTabs.Trigger.Icon sf="house.fill" />
        <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(ai)">
        <NativeTabs.Trigger.Icon sf="sparkles" />
        <NativeTabs.Trigger.Label>{t("tabs.ai")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Icon sf="plus" />
        <NativeTabs.Trigger.Label>{t("tabs.add")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(budgets)">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
        <NativeTabs.Trigger.Label>{t("tabs.budgets")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(menu)">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>{t("tabs.settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AndroidTabs() {
  const { t } = useTranslation();

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="(index)" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="(ai)" options={{ title: t("tabs.ai") }} />
      <Tabs.Screen name="add" options={{ title: t("tabs.add") }} />
      <Tabs.Screen name="(budgets)" options={{ title: t("tabs.budgets") }} />
      <Tabs.Screen name="(menu)" options={{ title: t("tabs.settings") }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  return Platform.OS === "ios" ? <IosTabs /> : <AndroidTabs />;
}
