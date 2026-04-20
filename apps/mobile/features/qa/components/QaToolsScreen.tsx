import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth";
import { ScreenLayout } from "@/shared/components";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { type QaFeatureFlagName, useQaDevtoolsStore } from "../devtools-store";
import {
  getDefaultQaTarget,
  isLocalQaAvailable,
  type LocalQaProfile,
  QA_TARGETS,
  type QaTarget,
} from "../index";
import { parseLocalQaProfileRouteParam, parseQaTargetRouteParam } from "../lib/route-params";
import { recordQaLog } from "../logging";

const QA_PROFILES = [
  "default",
  "empty",
  "two-accounts",
  "transfer-ready",
  "transfer-conflict",
] as const satisfies readonly LocalQaProfile[];

const QA_TARGET_LIST = [
  QA_TARGETS.home,
  QA_TARGETS.addChooser,
  QA_TARGETS.addTransaction,
  QA_TARGETS.addTransfer,
  QA_TARGETS.transferConflict,
  QA_TARGETS.financialAccounts,
  QA_TARGETS.profile,
] as const satisfies readonly QaTarget[];

const QA_TARGET_LABEL_KEYS: Record<QaTarget, string> = {
  [QA_TARGETS.home]: "home",
  [QA_TARGETS.addChooser]: "addChooser",
  [QA_TARGETS.onboarding]: "onboarding",
  [QA_TARGETS.addTransaction]: "addTransaction",
  [QA_TARGETS.addTransfer]: "addTransfer",
  [QA_TARGETS.transferConflict]: "transferConflict",
  [QA_TARGETS.financialAccounts]: "financialAccounts",
  [QA_TARGETS.profile]: "profile",
  [QA_TARGETS.qaTools]: "qaTools",
};

const FLAG_KEYS: readonly QaFeatureFlagName[] = [
  "networkInspectorEnabled",
  "logInspectorEnabled",
  "simulateOffline",
  "showQaBanner",
];

export function QaToolsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const localQaAvailable = isLocalQaAvailable();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const borderSubtle = useThemeColor("borderSubtle");
  const card = useThemeColor("card");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const localQaSession = useAuthStore((state) => state.localQaSession);
  const flags = useQaDevtoolsStore((state) => state.flags);
  const logs = useQaDevtoolsStore((state) => state.logs);
  const networkEvents = useQaDevtoolsStore((state) => state.networkEvents);
  const setFlag = useQaDevtoolsStore((state) => state.setFlag);
  const resetFlags = useQaDevtoolsStore((state) => state.resetFlags);
  const clearLogs = useQaDevtoolsStore((state) => state.clearLogs);
  const clearNetworkEvents = useQaDevtoolsStore((state) => state.clearNetworkEvents);
  const [isPreparing, setIsPreparing] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const lastAutoStartRequest = useRef<string | null>(null);
  const { profile: routeProfile, target: routeTarget } = useLocalSearchParams<{
    profile?: string | string[];
    target?: string | string[];
  }>();

  const runScenario = useCallback(
    async (profile: LocalQaProfile, target?: QaTarget) => {
      setErrorKey(null);
      setIsPreparing(true);
      recordQaLog("info", "qa_run_scenario_requested", { profile, target: target ?? null });

      try {
        await useAuthStore.getState().startLocalQaSession(profile);
        router.replace((target ?? getDefaultQaTarget(profile)) as never);
      } catch {
        setErrorKey("qaTools.startFailed");
        recordQaLog("error", "qa_run_scenario_failed", { profile });
      } finally {
        setIsPreparing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const nextProfile = parseLocalQaProfileRouteParam(routeProfile);
    const nextTarget = parseQaTargetRouteParam(routeTarget);

    if (!localQaAvailable || !nextProfile) return;

    const autoStartKey = JSON.stringify({
      profile: nextProfile,
      target: nextTarget ?? getDefaultQaTarget(nextProfile),
    });

    if (lastAutoStartRequest.current === autoStartKey) return;

    lastAutoStartRequest.current = autoStartKey;
    void runScenario(nextProfile, nextTarget ?? getDefaultQaTarget(nextProfile));
  }, [localQaAvailable, routeProfile, routeTarget, runScenario]);

  if (!localQaAvailable) {
    return (
      <ScreenLayout variant="sub" title={t("qaTools.title")} onBack={() => router.back()}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 14, color: secondary }}>
            {t("qaTools.unavailable")}
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout variant="sub" title={t("qaTools.title")} onBack={() => router.back()}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 32,
          gap: 24,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: secondary }}>
            {t("qaTools.subtitle")}
          </Text>
          <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
            {localQaSession
              ? t("qaTools.currentProfile", { profile: localQaSession.profile })
              : t("qaTools.noActiveProfile")}
          </Text>
          {errorKey ? (
            <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: "#C0392B" }}>
              {t(errorKey)}
            </Text>
          ) : null}
        </View>

        {isPreparing ? (
          <View
            style={{ alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 8 }}
          >
            <ActivityIndicator />
            <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 13, color: secondary }}>
              {t("qaTools.preparing")}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: primary }}>
            {t("qaTools.scenariosTitle")}
          </Text>
          {QA_PROFILES.map((profile) => (
            <Pressable
              key={profile}
              onPress={() => {
                void runScenario(profile);
              }}
              style={{
                borderRadius: 18,
                borderWidth: 1,
                borderColor: accentGreen,
                backgroundColor: accentGreenLight,
                paddingHorizontal: 14,
                paddingVertical: 14,
                gap: 4,
              }}
            >
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
                {t(`qaTools.profiles.${profile}.title`)}
              </Text>
              <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: secondary }}>
                {t(`qaTools.profiles.${profile}.description`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: primary }}>
            {t("qaTools.flagsTitle")}
          </Text>
          {FLAG_KEYS.map((flagName) => (
            <Pressable
              key={flagName}
              onPress={() => {
                setFlag(flagName, !flags[flagName]);
              }}
              testID={`qa.flag.${flagName}`}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: flags[flagName] ? accentGreen : borderSubtle,
                backgroundColor: flags[flagName] ? accentGreenLight : card,
                paddingHorizontal: 14,
                paddingVertical: 14,
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
                {t(`qaTools.flags.${flagName}.title`)}
              </Text>
              <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: secondary }}>
                {t(`qaTools.flags.${flagName}.description`)}
              </Text>
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 11, color: primary }}>
                {flags[flagName] ? t("qaTools.flagOn") : t("qaTools.flagOff")}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: primary }}>
            {t("qaTools.actionsTitle")}
          </Text>
          {localQaSession ? (
            <Pressable
              onPress={() => {
                void runScenario(
                  localQaSession.profile,
                  getDefaultQaTarget(localQaSession.profile)
                );
              }}
              testID="qa.action.reset-current"
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: borderSubtle,
                backgroundColor: card,
                paddingHorizontal: 14,
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
                {t("qaTools.actions.resetCurrentScenario")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              resetFlags();
            }}
            testID="qa.action.reset-flags"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: borderSubtle,
              backgroundColor: card,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
          >
            <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
              {t("qaTools.actions.resetFlags")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              clearLogs();
            }}
            testID="qa.action.clear-logs"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: borderSubtle,
              backgroundColor: card,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
          >
            <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
              {t("qaTools.actions.clearLogs")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              clearNetworkEvents();
            }}
            testID="qa.action.clear-network-events"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: borderSubtle,
              backgroundColor: card,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
          >
            <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
              {t("qaTools.actions.clearNetwork")}
            </Text>
          </Pressable>
          {localQaSession ? (
            <Pressable
              onPress={() => {
                void useAuthStore.getState().signOut();
                router.replace("/(auth)" as never);
              }}
              testID="qa.action.exit-local-qa"
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: borderSubtle,
                backgroundColor: card,
                paddingHorizontal: 14,
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: primary }}>
                {t("qaTools.actions.exitLocalQa")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: primary }}>
            {t("qaTools.openTitle")}
          </Text>
          {QA_TARGET_LIST.map((target) => (
            <Pressable
              key={target}
              onPress={() => {
                router.push(target as never);
              }}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: borderSubtle,
                backgroundColor: card,
                paddingHorizontal: 14,
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 14, color: primary }}>
                {t(`qaTools.open.${QA_TARGET_LABEL_KEYS[target]}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: primary }}>
            {t("qaTools.logsTitle")}
          </Text>
          {logs.length === 0 ? (
            <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: secondary }}>
              {t("qaTools.logsEmpty")}
            </Text>
          ) : (
            logs
              .slice()
              .reverse()
              .map((entry) => (
                <View
                  key={entry.id}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: borderSubtle,
                    backgroundColor: card,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: primary }}>
                    {`${entry.level.toUpperCase()} · ${entry.message}`}
                  </Text>
                  <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 11, color: secondary }}>
                    {entry.timestamp}
                  </Text>
                  {Object.keys(entry.context).length > 0 ? (
                    <Text
                      style={{ fontFamily: "Poppins_500Medium", fontSize: 11, color: secondary }}
                    >
                      {JSON.stringify(entry.context)}
                    </Text>
                  ) : null}
                </View>
              ))
          )}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: primary }}>
            {t("qaTools.networkTitle")}
          </Text>
          {networkEvents.length === 0 ? (
            <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 12, color: secondary }}>
              {t("qaTools.networkEmpty")}
            </Text>
          ) : (
            networkEvents
              .slice()
              .reverse()
              .map((event) => (
                <View
                  key={event.id}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: borderSubtle,
                    backgroundColor: card,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: primary }}>
                    {`${event.method} · ${event.outcome.toUpperCase()}${event.status ? ` · ${event.status}` : ""}`}
                  </Text>
                  <Text style={{ fontFamily: "Poppins_500Medium", fontSize: 11, color: secondary }}>
                    {event.url}
                  </Text>
                </View>
              ))
          )}
        </View>

        {localQaSession ? (
          <Pressable
            onPress={() => {
              router.push(getDefaultQaTarget(localQaSession.profile) as never);
            }}
            style={{
              borderRadius: 16,
              backgroundColor: accentGreen,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 14, color: "#FFFFFF" }}>
              {t("qaTools.openWithCurrentProfile")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}
