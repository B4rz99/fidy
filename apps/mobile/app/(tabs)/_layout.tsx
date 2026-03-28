import { Tabs } from "expo-router";
import { useState } from "react";
import { VoiceBottomSheet } from "@/features/voice";
import { CustomTabBar } from "@/shared/components";
import { useTranslation } from "@/shared/hooks";

export default function TabsLayout() {
  const { t } = useTranslation();
  const [voiceVisible, setVoiceVisible] = useState(false);
  const handleVoicePress = () => setVoiceVisible(true);

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        initialRouteName="(index)"
        tabBar={(props) => <CustomTabBar {...props} onVoicePress={handleVoicePress} />}
      >
        <Tabs.Screen name="(index)" options={{ title: t("tabs.home") }} />
        <Tabs.Screen name="(ai)" options={{ title: t("tabs.ai") }} />
        <Tabs.Screen name="add" options={{ title: t("tabs.add") }} />
        <Tabs.Screen name="(finance)" options={{ title: t("tabs.finance") }} />
        <Tabs.Screen name="(menu)" options={{ title: t("tabs.settings") }} />
      </Tabs>
      <VoiceBottomSheet visible={voiceVisible} onClose={() => setVoiceVisible(false)} />
    </>
  );
}
