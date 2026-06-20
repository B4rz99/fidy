import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useReducer, useRef } from "react";
import { useAuthStore } from "@/features/auth/public";
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

const qaLauncherErrorReducer = (_current: string | null, next: string | null) => next;

export function QaLauncherScreen() {
  const { back, replace } = useRouter();
  const { t } = useTranslation();
  const localQaAvailable = isLocalQaAvailable();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const danger = useThemeColor("danger");
  const [errorKey, dispatchQaError] = useReducer(qaLauncherErrorReducer, null);
  const lastLaunchRequest = useRef<string | null>(null);
  const { profile: rawProfile, targetKey: rawTargetKey } = useLocalSearchParams<{
    profile?: string | string[];
    targetKey?: string | string[];
  }>();

  const profile = parseLocalQaProfileRouteParam(rawProfile);
  const target = parseQaTargetKeyRouteParam(rawTargetKey);

  useEffect(() => {
    if (!localQaAvailable) {
      dispatchQaError("qaTools.unavailable");
      return;
    }

    if (!profile) {
      dispatchQaError("qaTools.unavailable");
      return;
    }

    const nextTarget = target ?? getDefaultQaTarget(profile);
    const launchRequestKey = JSON.stringify({
      profile,
      target: nextTarget,
    });

    if (lastLaunchRequest.current === launchRequestKey) return;

    lastLaunchRequest.current = launchRequestKey;
    dispatchQaError(null);
    recordQaLog("info", "qa_launcher_requested", { profile, target: nextTarget });

    void launchQaScenario(profile, nextTarget, replace).catch((error) => {
      dispatchQaError("qaTools.startFailed");
      recordQaLog("error", "qa_launcher_failed", {
        profile,
        target: nextTarget,
        errorMessage: error instanceof Error ? error.message : "unknown",
      });
    });
  }, [localQaAvailable, profile, target, replace]);

  if (!localQaAvailable) {
    return null;
  }

  return (
    <ScreenLayout variant="sub" title={t("qaTools.title")} onBack={() => back()}>
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
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: danger }}>
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
