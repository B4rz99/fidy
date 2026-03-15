import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import { captureError } from "@/shared/lib/sentry";
import { insertDetectedSmsEvent } from "../lib/repository";
import { processApplePayIntent } from "../services/apple-pay-pipeline";
import { processNotification } from "../services/notification-pipeline";

const noop = () => {};

// Dynamic import to avoid Android bundle crash — this module calls
// requireNativeModule("ExpoAppIntents") which only exists on iOS.
const loadAppIntents = () =>
  import("@/modules/expo-app-intents") as Promise<typeof import("@/modules/expo-app-intents")>;

export async function setupApplePayCapture(db: AnyDb, userId: string): Promise<() => void> {
  const mod = await loadAppIntents();
  if (!mod.isAvailable()) return noop;

  const subscription = mod.addLogTransactionListener((event) => {
    processApplePayIntent(db, userId, event).catch(captureError);
  });

  return () => subscription.remove();
}

export async function setupSmsDetection(
  db: AnyDb,
  userId: string,
  refreshDetectedSms: () => void
): Promise<() => void> {
  const mod = await loadAppIntents();
  if (!mod.isAvailable()) return noop;

  const subscription = mod.addDetectBankSmsListener((event) => {
    insertDetectedSmsEvent(db, {
      id: generateId("sms"),
      userId,
      senderLabel: event.senderName,
      detectedAt: event.timestamp,
      dismissed: false,
      linkedTransactionId: null,
      createdAt: new Date().toISOString(),
    })
      .then(() => refreshDetectedSms())
      .catch(captureError);
  });

  return () => subscription.remove();
}

export async function setupNotificationCapture(
  db: AnyDb,
  userId: string,
  packages: string[]
): Promise<() => void> {
  if (packages.length === 0) return noop;

  // Dynamic import to avoid iOS bundle crash — this module has Android native code
  const mod = (await import("expo-android-notification-listener-service")) as unknown as {
    setAllowedPackages: (packages: string[]) => void;
    addListener: (event: string, listener: (event: unknown) => void) => { remove: () => void };
  };

  mod.setAllowedPackages(packages);

  const subscription = mod.addListener("onNotificationReceived", (event: unknown) => {
    processNotification(db, userId, event as Parameters<typeof processNotification>[2]).catch(
      captureError
    );
  });

  return () => subscription.remove();
}
