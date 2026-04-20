import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { isLocalQaAvailable } from "./local-session";

const QA_DEVTOOLS_FLAGS_KEY = "qa_devtools_flags_v1";
const MAX_QA_LOGS = 60;
const MAX_QA_NETWORK_EVENTS = 60;

export type QaFeatureFlags = {
  readonly networkInspectorEnabled: boolean;
  readonly logInspectorEnabled: boolean;
  readonly simulateOffline: boolean;
  readonly showQaBanner: boolean;
};

export type QaFeatureFlagName = keyof QaFeatureFlags;

type QaLogContextValue = string | number | boolean | null;

export type QaLogEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly level: "info" | "warn" | "error";
  readonly message: string;
  readonly context: Readonly<Record<string, QaLogContextValue>>;
};

export type QaNetworkEvent = {
  readonly id: string;
  readonly timestamp: string;
  readonly method: string;
  readonly url: string;
  readonly outcome: "success" | "error" | "blocked";
  readonly status: number | null;
  readonly durationMs: number;
  readonly errorMessage: string | null;
};

type QaDevtoolsState = {
  readonly flags: QaFeatureFlags;
  readonly logs: readonly QaLogEntry[];
  readonly networkEvents: readonly QaNetworkEvent[];
};

type QaDevtoolsActions = {
  readonly setFlag: (name: QaFeatureFlagName, value: boolean) => void;
  readonly resetFlags: () => void;
  readonly clearLogs: () => void;
  readonly clearNetworkEvents: () => void;
  readonly recordLog: (entry: Omit<QaLogEntry, "id" | "timestamp">) => void;
  readonly recordNetworkEvent: (event: Omit<QaNetworkEvent, "id" | "timestamp">) => void;
};

const DEFAULT_QA_FEATURE_FLAGS: QaFeatureFlags = {
  networkInspectorEnabled: true,
  logInspectorEnabled: true,
  simulateOffline: false,
  showQaBanner: false,
};

function buildStoredFlagsKey() {
  return QA_DEVTOOLS_FLAGS_KEY;
}

function parseStoredFlags(value: string | null): QaFeatureFlags {
  if (!value) return DEFAULT_QA_FEATURE_FLAGS;

  try {
    const parsed = JSON.parse(value) as Partial<Record<QaFeatureFlagName, unknown>>;

    return {
      networkInspectorEnabled:
        typeof parsed.networkInspectorEnabled === "boolean"
          ? parsed.networkInspectorEnabled
          : DEFAULT_QA_FEATURE_FLAGS.networkInspectorEnabled,
      logInspectorEnabled:
        typeof parsed.logInspectorEnabled === "boolean"
          ? parsed.logInspectorEnabled
          : DEFAULT_QA_FEATURE_FLAGS.logInspectorEnabled,
      simulateOffline:
        typeof parsed.simulateOffline === "boolean"
          ? parsed.simulateOffline
          : DEFAULT_QA_FEATURE_FLAGS.simulateOffline,
      showQaBanner:
        typeof parsed.showQaBanner === "boolean"
          ? parsed.showQaBanner
          : DEFAULT_QA_FEATURE_FLAGS.showQaBanner,
    };
  } catch {
    return DEFAULT_QA_FEATURE_FLAGS;
  }
}

function loadStoredFlags(): QaFeatureFlags {
  if (!isLocalQaAvailable()) return DEFAULT_QA_FEATURE_FLAGS;

  try {
    return parseStoredFlags(SecureStore.getItem(buildStoredFlagsKey()));
  } catch {
    return DEFAULT_QA_FEATURE_FLAGS;
  }
}

function persistFlags(flags: QaFeatureFlags) {
  if (!isLocalQaAvailable()) return;

  try {
    SecureStore.setItem(buildStoredFlagsKey(), JSON.stringify(flags));
  } catch {
    // Best-effort persistence only.
  }
}

function appendBounded<T>(current: readonly T[], next: T, maxItems: number) {
  return [...current, next].slice(-maxItems);
}

function buildEntryId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useQaDevtoolsStore = create<QaDevtoolsState & QaDevtoolsActions>((set, get) => ({
  flags: loadStoredFlags(),
  logs: [],
  networkEvents: [],

  setFlag: (name, value) => {
    if (!isLocalQaAvailable()) return;

    const nextFlags = {
      ...get().flags,
      [name]: value,
    } satisfies QaFeatureFlags;

    persistFlags(nextFlags);
    set({ flags: nextFlags });
  },

  resetFlags: () => {
    if (!isLocalQaAvailable()) return;

    persistFlags(DEFAULT_QA_FEATURE_FLAGS);
    set({ flags: DEFAULT_QA_FEATURE_FLAGS });
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  clearNetworkEvents: () => {
    set({ networkEvents: [] });
  },

  recordLog: (entry) => {
    if (!isLocalQaAvailable() || !get().flags.logInspectorEnabled) return;

    set((state) => ({
      logs: appendBounded(
        state.logs,
        {
          id: buildEntryId("qa-log"),
          timestamp: new Date().toISOString(),
          ...entry,
        },
        MAX_QA_LOGS
      ),
    }));
  },

  recordNetworkEvent: (event) => {
    if (!isLocalQaAvailable() || !get().flags.networkInspectorEnabled) return;

    set((state) => ({
      networkEvents: appendBounded(
        state.networkEvents,
        {
          id: buildEntryId("qa-net"),
          timestamp: new Date().toISOString(),
          ...event,
        },
        MAX_QA_NETWORK_EVENTS
      ),
    }));
  },
}));

export const qaFeatureFlags = {
  defaults: DEFAULT_QA_FEATURE_FLAGS,
};
