import { Platform } from "react-native";
import { create } from "zustand";
import type { AnyDb } from "@/shared/db/client";
import {
  getEnabledPackages,
  getTodaySmsEventCount,
  hasProcessedCaptures,
  upsertNotificationSource,
} from "./lib/repository";
import { KNOWN_BANK_PACKAGES } from "./schema";

let dbRef: AnyDb | null = null;
let userIdRef: string | null = null;

type CaptureSourcesState = {
  enabledPackages: string[];
  isNotificationPermissionGranted: boolean;
  isApplePaySetupComplete: boolean;
  detectedSmsCount: number;
};

type CaptureSourcesActions = {
  initStore: (db: AnyDb, userId: string) => void;
  hydrate: () => Promise<void>;
  loadConfig: () => Promise<void>;
  togglePackage: (packageName: string, enabled: boolean) => Promise<void>;
  checkPermissions: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshDetectedSms: () => Promise<void>;
  _resetRefs: () => void;
};

export const useCaptureSourcesStore = create<CaptureSourcesState & CaptureSourcesActions>(
  (set, get) => ({
    enabledPackages: [],
    isNotificationPermissionGranted: false,
    isApplePaySetupComplete: false,
    detectedSmsCount: 0,

    initStore: (db, userId) => {
      dbRef = db;
      userIdRef = userId;
    },

    _resetRefs: () => {
      dbRef = null;
      userIdRef = null;
    },

    hydrate: async () => {
      const { loadConfig, checkPermissions, refreshStatus, refreshDetectedSms } = get();
      await Promise.allSettled([
        loadConfig(),
        checkPermissions(),
        refreshStatus(),
        refreshDetectedSms(),
      ]);
    },

    loadConfig: async () => {
      if (!dbRef || !userIdRef) return;
      const enabledPackages = await getEnabledPackages(dbRef, userIdRef);
      set({ enabledPackages });
    },

    checkPermissions: async () => {
      if (Platform.OS !== "android") return;
      try {
        const mod = require("expo-android-notification-listener-service") as {
          isPermissionGranted: () => Promise<boolean>;
        };
        const granted = await mod.isPermissionGranted();
        set({ isNotificationPermissionGranted: granted });
      } catch {
        // Module not available — leave as false
      }
    },

    togglePackage: async (packageName, enabled) => {
      if (!dbRef || !userIdRef) return;

      const knownPkg = KNOWN_BANK_PACKAGES.find((p) => p.packageName === packageName);
      const label = knownPkg?.label ?? packageName;

      await upsertNotificationSource(
        dbRef,
        userIdRef,
        packageName,
        label,
        enabled,
        new Date().toISOString()
      );

      const updated = enabled
        ? [...get().enabledPackages, packageName]
        : get().enabledPackages.filter((p) => p !== packageName);
      set({ enabledPackages: updated });
    },

    refreshStatus: async () => {
      if (!dbRef) return;
      const isApplePaySetupComplete = await hasProcessedCaptures(dbRef, "apple_pay");
      set({ isApplePaySetupComplete });
    },

    refreshDetectedSms: async () => {
      if (!dbRef || !userIdRef) return;
      const detectedSmsCount = await getTodaySmsEventCount(dbRef, userIdRef, new Date());
      set({ detectedSmsCount });
    },
  })
);
