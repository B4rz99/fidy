import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/public";
import {
  getDefaultQaTarget,
  isLocalQaAvailable,
  type LocalQaProfile,
  type QaTarget,
} from "../../index";
import { parseLocalQaProfileRouteParam, parseQaTargetRouteParam } from "../../lib/route-params";
import { recordQaLog } from "../../logging";
import { buildAutoStartRequestKey, getResolvedQaTarget } from "./QaTools.constants";

type QaScenarioRunnerResult = {
  readonly errorKey: string | null;
  readonly isPreparing: boolean;
  readonly localQaAvailable: boolean;
  readonly router: ReturnType<typeof useRouter>;
  readonly runScenario: (profile: LocalQaProfile, target?: QaTarget) => Promise<void>;
};

type PendingQaAutoStart = {
  readonly profile: LocalQaProfile;
  readonly requestKey: string;
  readonly target?: QaTarget;
};

function getPendingQaAutoStart(
  lastRequestKey: string | null,
  localQaAvailable: boolean,
  routeProfile: string | string[] | undefined,
  routeTarget: string | string[] | undefined
): PendingQaAutoStart | null {
  if (!localQaAvailable) {
    return null;
  }

  const profile = parseLocalQaProfileRouteParam(routeProfile);
  if (!profile) {
    return null;
  }

  const target = parseQaTargetRouteParam(routeTarget) ?? undefined;
  const requestKey = buildAutoStartRequestKey(profile, target);

  return lastRequestKey === requestKey ? null : { profile, requestKey, target };
}

function useQaAutoStartScenario(
  localQaAvailable: boolean,
  routeProfile: string | string[] | undefined,
  routeTarget: string | string[] | undefined,
  runScenario: (profile: LocalQaProfile, target?: QaTarget) => Promise<void>
) {
  const lastAutoStartRequest = useRef<string | null>(null);

  useEffect(() => {
    const pendingAutoStart = getPendingQaAutoStart(
      lastAutoStartRequest.current,
      localQaAvailable,
      routeProfile,
      routeTarget
    );
    if (!pendingAutoStart) return;

    lastAutoStartRequest.current = pendingAutoStart.requestKey;
    void runScenario(pendingAutoStart.profile, pendingAutoStart.target);
  }, [localQaAvailable, routeProfile, routeTarget, runScenario]);
}

function useQaScenarioNavigation(router: ReturnType<typeof useRouter>) {
  return {
    onBack: useCallback(() => {
      router.back();
    }, [router]),
    onExitLocalQa: useCallback(() => {
      void useAuthStore.getState().signOut();
      router.replace("/(auth)" as never);
    }, [router]),
    onOpenTarget: useCallback(
      (target: QaTarget) => {
        router.push(target as never);
      },
      [router]
    ),
  };
}

export function useQaScenarioRunner(activeProfile: LocalQaProfile | null): QaScenarioRunnerResult &
  ReturnType<typeof useQaScenarioNavigation> & {
    readonly onOpenCurrentProfileTarget: () => void;
    readonly onResetCurrentScenario: () => void;
  } {
  const router = useRouter();
  const localQaAvailable = isLocalQaAvailable();
  const [isPreparing, setIsPreparing] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const { profile: routeProfile, target: routeTarget } = useLocalSearchParams<{
    profile?: string | string[];
    target?: string | string[];
  }>();
  const navigation = useQaScenarioNavigation(router);

  const runScenario = useCallback(
    async (profile: LocalQaProfile, target?: QaTarget) => {
      setErrorKey(null);
      setIsPreparing(true);
      recordQaLog("info", "qa_run_scenario_requested", { profile, target: target ?? null });

      try {
        await useAuthStore.getState().startLocalQaSession(profile);
        router.replace(getResolvedQaTarget(profile, target) as never);
      } catch {
        setErrorKey("qaTools.startFailed");
        recordQaLog("error", "qa_run_scenario_failed", { profile });
      } finally {
        setIsPreparing(false);
      }
    },
    [router]
  );

  useQaAutoStartScenario(localQaAvailable, routeProfile, routeTarget, runScenario);

  return {
    ...navigation,
    errorKey,
    isPreparing,
    localQaAvailable,
    onOpenCurrentProfileTarget: useCallback(() => {
      if (!activeProfile) return;
      router.push(getDefaultQaTarget(activeProfile) as never);
    }, [activeProfile, router]),
    onResetCurrentScenario: useCallback(() => {
      if (!activeProfile) return;
      void runScenario(activeProfile, getDefaultQaTarget(activeProfile));
    }, [activeProfile, runScenario]),
    router,
    runScenario,
  };
}
