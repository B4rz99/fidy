import { create } from "zustand";
import { Platform } from "@/shared/components/rn";
import type { AnyDb } from "@/shared/db";
import { toIsoDateTime } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import {
  getEnabledPackages,
  getTodaySmsEventCount,
  hasProcessedCaptures,
  upsertNotificationSource,
} from "./lib/repository";
import { KNOWN_BANK_PACKAGES } from "./schema";

type CaptureSourcesState = {
  enabledPackages: string[];
  isNotificationPermissionGranted: boolean;
  isApplePaySetupComplete: boolean;
  detectedSmsCount: number;
};

type CaptureSourcesActions = {
  setEnabledPackages: (enabledPackages: readonly string[]) => void;
  setNotificationPermissionGranted: (isNotificationPermissionGranted: boolean) => void;
  setApplePaySetupComplete: (isApplePaySetupComplete: boolean) => void;
  setDetectedSmsCount: (detectedSmsCount: number) => void;
};

export const useCaptureSourcesStore = create<CaptureSourcesState & CaptureSourcesActions>(
  (set) => ({
    enabledPackages: [],
    isNotificationPermissionGranted: false,
    isApplePaySetupComplete: false,
    detectedSmsCount: 0,

    setEnabledPackages: (enabledPackages) => set({ enabledPackages: [...enabledPackages] }),

    setNotificationPermissionGranted: (isNotificationPermissionGranted) =>
      set({ isNotificationPermissionGranted }),

    setApplePaySetupComplete: (isApplePaySetupComplete) => set({ isApplePaySetupComplete }),

    setDetectedSmsCount: (detectedSmsCount) => set({ detectedSmsCount }),
  })
);

async function loadCaptureSourceConfig(db: AnyDb, userId: UserId): Promise<void> {
  const enabledPackages = await getEnabledPackages(db, userId);
  useCaptureSourcesStore.getState().setEnabledPackages(enabledPackages);
}

async function checkCaptureSourcePermissions(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module load; dynamic import() not supported for native modules
    const mod = require("expo-android-notification-listener-service") as {
      isPermissionGranted: () => Promise<boolean>;
    };
    const granted = await mod.isPermissionGranted();
    useCaptureSourcesStore.getState().setNotificationPermissionGranted(granted);
  } catch {
    // Module not available — leave as false
  }
}

function getUpdatedEnabledPackages(
  enabledPackages: readonly string[],
  packageName: string,
  enabled: boolean
): string[] {
  if (enabled) {
    return enabledPackages.includes(packageName)
      ? [...enabledPackages]
      : [...enabledPackages, packageName];
  }

  return enabledPackages.filter((pkg) => pkg !== packageName);
}

export async function hydrateCaptureSources(db: AnyDb, userId: UserId): Promise<void> {
  await Promise.allSettled([
    loadCaptureSourceConfig(db, userId),
    checkCaptureSourcePermissions(),
    refreshCaptureSourceStatus(db),
    refreshDetectedSmsCount(db, userId),
  ]);
}

export async function toggleCaptureSourcePackage(
  db: AnyDb,
  userId: UserId,
  packageName: string,
  enabled: boolean
): Promise<void> {
  const knownPkg = KNOWN_BANK_PACKAGES.find((pkg) => pkg.packageName === packageName);
  const label = knownPkg?.label ?? packageName;

  await upsertNotificationSource(
    db,
    userId,
    packageName,
    label,
    enabled,
    toIsoDateTime(new Date())
  );

  const updated = getUpdatedEnabledPackages(
    useCaptureSourcesStore.getState().enabledPackages,
    packageName,
    enabled
  );
  useCaptureSourcesStore.getState().setEnabledPackages(updated);
}

export async function refreshCaptureSourceStatus(db: AnyDb): Promise<void> {
  const isApplePaySetupComplete = await hasProcessedCaptures(db, "apple_pay");
  useCaptureSourcesStore.getState().setApplePaySetupComplete(isApplePaySetupComplete);
}

export async function refreshDetectedSmsCount(
  db: AnyDb,
  userId: UserId,
  now: Date = new Date()
): Promise<void> {
  const detectedSmsCount = await getTodaySmsEventCount(db, userId, now);
  useCaptureSourcesStore.getState().setDetectedSmsCount(detectedSmsCount);
}
