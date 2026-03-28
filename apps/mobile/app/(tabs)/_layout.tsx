import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useState } from "react";
import { VoiceBottomSheet } from "@/features/voice";
import { CustomTabBar } from "@/shared/components";
import { Platform } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";

function IosTabs({ onVoicePress: _onVoicePress }: { onVoicePress: () => void }) {
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
      <NativeTabs.Trigger name="(finance)">
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
        <NativeTabs.Trigger.Label>{t("tabs.finance")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(menu)">
        <NativeTabs.Trigger.Icon sf="gearshape" />
        <NativeTabs.Trigger.Label>{t("tabs.settings")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function AndroidTabs({ onVoicePress }: { onVoicePress: () => void }) {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      initialRouteName="(index)"
      tabBar={(props) => <CustomTabBar {...props} onVoicePress={onVoicePress} />}
    >
      <Tabs.Screen name="(index)" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="(ai)" options={{ title: t("tabs.ai") }} />
      <Tabs.Screen name="add" options={{ title: t("tabs.add") }} />
      <Tabs.Screen name="(finance)" options={{ title: t("tabs.finance") }} />
      <Tabs.Screen name="(menu)" options={{ title: t("tabs.settings") }} />
    </Tabs>
  );
}

export default function TabsLayout() {
  const [voiceVisible, setVoiceVisible] = useState(false);
  const handleVoicePress = () => setVoiceVisible(true);

  return (
    <>
      {Platform.OS === "ios" ? (
        <IosTabs onVoicePress={handleVoicePress} />
      ) : (
        <AndroidTabs onVoicePress={handleVoicePress} />
      )}
      <VoiceBottomSheet visible={voiceVisible} onClose={() => setVoiceVisible(false)} />
    </>
  );
}
