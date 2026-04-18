import { insertDetectedSmsEvent } from "@/features/capture-sources/lib/repository";
import { processApplePayIntent } from "@/features/capture-sources/services/apple-pay-pipeline";
import { processNotification } from "@/features/capture-sources/services/notification-pipeline";
import type { AnyDb } from "@/shared/db";
import { captureError, generateDetectedSmsEventId, toIsoDateTime } from "@/shared/lib";
import { requireIsoDateTime } from "@/shared/types/assertions";
import type { IsoDateTime, UserId } from "@/shared/types/branded";
import type { ApplePayIntentData, NotificationData } from "../schema";
import { createCaptureIngestionPort } from "../services/capture-ingestion";

const noop = () => undefined;
const EPOCH_MILLISECONDS_PATTERN = /^\d{13}$/;
const EPOCH_SECONDS_PATTERN = /^\d{10}$/;

function parseSmsDetectedAt(timestamp: string): IsoDateTime | null {
  const trimmedTimestamp = timestamp.trim();

  if (trimmedTimestamp.length === 0) {
    return null;
  }

  try {
    return requireIsoDateTime(trimmedTimestamp);
  } catch {
    const parsedDate = EPOCH_MILLISECONDS_PATTERN.test(trimmedTimestamp)
      ? new Date(Number(trimmedTimestamp))
      : EPOCH_SECONDS_PATTERN.test(trimmedTimestamp)
        ? new Date(Number(trimmedTimestamp) * 1000)
        : new Date(trimmedTimestamp);

    return Number.isNaN(parsedDate.getTime()) ? null : toIsoDateTime(parsedDate);
  }
}

// Dynamic import to avoid Android bundle crash — this module calls
// requireNativeModule("ExpoAppIntents") which only exists on iOS.
const loadAppIntents = () => import("@/modules/expo-app-intents");

export async function setupApplePayCapture(db: AnyDb, userId: UserId): Promise<() => void> {
  const captureIngestion = createCaptureIngestionPort(db, {
    processApplePayIntent,
  });
  const mod = await loadAppIntents();
  if (!mod.isAvailable()) return noop;

  const subscription = mod.addLogTransactionListener((event) => {
    captureIngestion
      .ingest({
        kind: "apple_pay",
        userId,
        intent: event as ApplePayIntentData,
      })
      .catch(captureError);
  });

  return () => subscription.remove();
}

export async function setupSmsDetection(
  db: AnyDb,
  userId: UserId,
  refreshDetectedSms: () => void
): Promise<() => void> {
  const mod = await loadAppIntents();
  if (!mod.isAvailable()) return noop;

  const subscription = mod.addDetectBankSmsListener((event) => {
    const detectedAt = parseSmsDetectedAt(event.timestamp);

    if (detectedAt == null) {
      captureError(new Error(`Invalid SMS detection timestamp: ${event.timestamp}`));
      return;
    }

    insertDetectedSmsEvent(db, {
      id: generateDetectedSmsEventId(),
      userId,
      senderLabel: event.senderName,
      detectedAt,
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
  userId: UserId,
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
        userId,
        notification: event as NotificationData,
      })
      .catch(captureError);
  });

  return () => subscription.remove();
}
