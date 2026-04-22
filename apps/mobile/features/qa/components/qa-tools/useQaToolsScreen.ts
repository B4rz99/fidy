import { useCallback } from "react";
import { useAuthStore } from "@/features/auth";
import {
  type QaFeatureFlagName,
  type QaNetworkEvent,
  useQaDevtoolsStore,
} from "../../devtools-store";
import type { LocalQaProfile, QaTarget } from "../../index";
import { useQaScenarioRunner } from "./useQaScenarioRunner";

export type QaLogEntry = ReturnType<typeof useQaDevtoolsStore.getState>["logs"][number];

export type QaToolsViewModel = {
  readonly activeProfile: LocalQaProfile | null;
  readonly errorKey: string | null;
  readonly flags: ReturnType<typeof useQaDevtoolsStore.getState>["flags"];
  readonly isPreparing: boolean;
  readonly localQaAvailable: boolean;
  readonly logs: readonly QaLogEntry[];
  readonly networkEvents: readonly QaNetworkEvent[];
  readonly onBack: () => void;
  readonly onClearLogs: () => void;
  readonly onClearNetworkEvents: () => void;
  readonly onExitLocalQa: () => void;
  readonly onOpenCurrentProfileTarget: () => void;
  readonly onOpenTarget: (target: QaTarget) => void;
  readonly onResetCurrentScenario: () => void;
  readonly onResetFlags: () => void;
  readonly onRunScenario: (profile: LocalQaProfile, target?: QaTarget) => void;
  readonly onToggleFlag: (flagName: QaFeatureFlagName) => void;
};

function useQaToolsDevtoolsActions(
  clearLogs: ReturnType<typeof useQaDevtoolsStore.getState>["clearLogs"],
  clearNetworkEvents: ReturnType<typeof useQaDevtoolsStore.getState>["clearNetworkEvents"],
  flags: ReturnType<typeof useQaDevtoolsStore.getState>["flags"],
  resetFlags: ReturnType<typeof useQaDevtoolsStore.getState>["resetFlags"],
  setFlag: ReturnType<typeof useQaDevtoolsStore.getState>["setFlag"]
) {
  return {
    onClearLogs: useCallback(() => {
      clearLogs();
    }, [clearLogs]),
    onClearNetworkEvents: useCallback(() => {
      clearNetworkEvents();
    }, [clearNetworkEvents]),
    onResetFlags: useCallback(() => {
      resetFlags();
    }, [resetFlags]),
    onToggleFlag: useCallback(
      (flagName: QaFeatureFlagName) => {
        setFlag(flagName, !flags[flagName]);
      },
      [flags, setFlag]
    ),
  };
}

export function useQaToolsScreen(): QaToolsViewModel {
  const localQaSession = useAuthStore((state) => state.localQaSession);
  const flags = useQaDevtoolsStore((state) => state.flags);
  const logs = useQaDevtoolsStore((state) => state.logs);
  const networkEvents = useQaDevtoolsStore((state) => state.networkEvents);
  const setFlag = useQaDevtoolsStore((state) => state.setFlag);
  const resetFlags = useQaDevtoolsStore((state) => state.resetFlags);
  const clearLogs = useQaDevtoolsStore((state) => state.clearLogs);
  const clearNetworkEvents = useQaDevtoolsStore((state) => state.clearNetworkEvents);
  const activeProfile = localQaSession?.profile ?? null;
  const scenarioRunner = useQaScenarioRunner(activeProfile);

  const devtoolsActions = useQaToolsDevtoolsActions(
    clearLogs,
    clearNetworkEvents,
    flags,
    resetFlags,
    setFlag
  );

  return {
    activeProfile,
    ...devtoolsActions,
    errorKey: scenarioRunner.errorKey,
    flags,
    isPreparing: scenarioRunner.isPreparing,
    localQaAvailable: scenarioRunner.localQaAvailable,
    logs,
    networkEvents,
    onBack: scenarioRunner.onBack,
    onExitLocalQa: scenarioRunner.onExitLocalQa,
    onOpenCurrentProfileTarget: scenarioRunner.onOpenCurrentProfileTarget,
    onOpenTarget: scenarioRunner.onOpenTarget,
    onResetCurrentScenario: scenarioRunner.onResetCurrentScenario,
    onRunScenario: useCallback(
      (profile: LocalQaProfile, target?: QaTarget) => {
        void scenarioRunner.runScenario(profile, target);
      },
      [scenarioRunner]
    ),
  };
}
