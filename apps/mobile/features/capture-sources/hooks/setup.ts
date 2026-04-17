import { insertDetectedSmsEvent } from "@/features/capture-sources/lib/repository";
import { processApplePayIntent } from "@/features/capture-sources/services/apple-pay-pipeline";
import { processNotification } from "@/features/capture-sources/services/notification-pipeline";
import type { AnyDb } from "@/shared/db";
import { captureError, generateDetectedSmsEventId, toIsoDateTime } from "@/shared/lib";
import type { IsoDateTime, UserId } from "@/shared/types/branded";
import type { ApplePayIntentData, NotificationData } from "../schema";
import { createCaptureIngestionPort } from "../services/capture-ingestion";

const noop = () => undefined;

// Dynamic import to avoid Android bundle crash — this module calls
// requireNativeModule("ExpoAppIntents") which only exists on iOS.
const loadAppIntents = () => import("@/modules/expo-app-intents");

export async function setupApplePayCapture(db: AnyDb, userId: string): Promise<() => void> {
  const captureIngestion = createCaptureIngestionPort(db, {
    processApplePayIntent,
  });
  const mod = await loadAppIntents();
  if (!mod.isAvailable()) return noop;

  const subscription = mod.addLogTransactionListener((event) => {
    captureIngestion
      .ingest({
        kind: "apple_pay",
        userId: userId as UserId,
        intent: event as ApplePayIntentData,
      })
      .catch(captureError);
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
      id: generateDetectedSmsEventId(),
      userId: userId as UserId,
      senderLabel: event.senderName,
      detectedAt: event.timestamp as IsoDateTime,
      dismissed: false,
      linkedTransactionId: null,
      createdAt: toIsoDateTime(new Date()),
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
  const captureIngestion = createCaptureIngestionPort(db, {
    processNotification,
  });
  if (packages.length === 0) return noop;

  // Dynamic import to avoid iOS bundle crash — this module has Android native code
  const mod = (await import("expo-android-notification-listener-service")) as unknown as {
    setAllowedPackages: (packages: string[]) => void;
    addListener: (event: string, listener: (event: unknown) => void) => { remove: () => void };
  };

  mod.setAllowedPackages(packages);

  const subscription = mod.addListener("onNotificationReceived", (event: unknown) => {
    captureIngestion
      .ingest({
        kind: "notification",
        userId: userId as UserId,
        notification: event as NotificationData,
      })
      .catch(captureError);
  });

  return () => subscription.remove();
}
