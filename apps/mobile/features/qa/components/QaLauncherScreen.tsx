import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth";
import { ScreenLayout } from "@/shared/components";
import { ActivityIndicator, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import {
  getDefaultQaTarget,
  isLocalQaAvailable,
  type LocalQaProfile,
  type QaTarget,
} from "../index";
import { parseLocalQaProfileRouteParam, parseQaTargetKeyRouteParam } from "../lib/route-params";
import { recordQaLog } from "../logging";

export function QaLauncherScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const lastLaunchRequest = useRef<string | null>(null);
  const { profile: rawProfile, targetKey: rawTargetKey } = useLocalSearchParams<{
    profile?: string | string[];
    targetKey?: string | string[];
  }>();

  const profile = parseLocalQaProfileRouteParam(rawProfile);
  const target = parseQaTargetKeyRouteParam(rawTargetKey);

  useEffect(() => {
    if (!profile) {
      setErrorKey("qaTools.unavailable");
      return;
    }

    const nextTarget = target ?? getDefaultQaTarget(profile);
    const launchRequestKey = JSON.stringify({
      profile,
      target: nextTarget,
    });

    if (lastLaunchRequest.current === launchRequestKey) return;

    lastLaunchRequest.current = launchRequestKey;
    setErrorKey(null);
    recordQaLog("info", "qa_launcher_requested", { profile, target: nextTarget });

    void launchQaScenario(profile, nextTarget, router.replace).catch((error) => {
      setErrorKey("qaTools.startFailed");
      recordQaLog("error", "qa_launcher_failed", {
        profile,
        target: nextTarget,
        errorMessage: error instanceof Error ? error.message : "unknown",
      });
    });
  }, [profile, target, router.replace]);

  if (!isLocalQaAvailable()) {
    return null;
  }

  return (
    <ScreenLayout variant="sub" title={t("qaTools.title")} onBack={() => router.back()}>
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}
      >
        <ActivityIndicator />
        <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
          {t("qaTools.preparing")}
        </Text>
        {profile ? (
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: secondary }}>
            {t("qaTools.currentProfile", { profile })}
          </Text>
        ) : null}
        {errorKey ? (
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: "#C0392B" }}>
            {t(errorKey)}
          </Text>
        ) : null}
      </View>
    </ScreenLayout>
  );
}

async function launchQaScenario(
  profile: LocalQaProfile,
  target: QaTarget,
  replace: (href: never) => void
) {
  await useAuthStore.getState().startLocalQaSession(profile);
  replace(target as never);
}
