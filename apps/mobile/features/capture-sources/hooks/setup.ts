import { insertDetectedSmsEvent } from "@/features/capture-sources/lib/repository";
import { processApplePayIntent } from "@/features/capture-sources/services/apple-pay-pipeline";
import { processNotification } from "@/features/capture-sources/services/notification-pipeline";
import type { AnyDb } from "@/shared/db";
import {
  captureError,
  captureWarning,
  generateDetectedSmsEventId,
  toIsoDateTime,
} from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import { parseSmsDetectedAt } from "../lib/parse-sms-detected-at";
import {
  applePayIntentDataSchema,
  notificationDataSchema,
  smsDetectionDataSchema,
} from "../schema";
import { createCaptureIngestionPort } from "../services/capture-ingestion";

const noop = () => undefined;

const issueCount = (issues: readonly unknown[]): number => issues.length;

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
    const parsed = applePayIntentDataSchema.safeParse(event);
    if (!parsed.success) {
      captureWarning("apple_pay_capture_invalid_payload", {
        issueCount: issueCount(parsed.error.issues),
      });
      return;
    }

    captureIngestion
      .ingest({
        kind: "apple_pay",
        userId,
        intent: parsed.data,
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
    const parsed = smsDetectionDataSchema.safeParse(event);
    if (!parsed.success) {
      captureWarning("sms_detection_invalid_payload", {
        issueCount: issueCount(parsed.error.issues),
      });
      return;
    }

    const detectedAt = parseSmsDetectedAt(parsed.data.timestamp);

    if (detectedAt == null) {
      captureError(new Error(`Invalid SMS detection timestamp: ${parsed.data.timestamp}`));
      return;
    }

    insertDetectedSmsEvent(db, {
      id: generateDetectedSmsEventId(),
      userId,
      senderLabel: parsed.data.senderName,
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
    const parsed = notificationDataSchema.safeParse(event);
    if (!parsed.success) {
      captureWarning("notification_capture_invalid_payload", {
        issueCount: issueCount(parsed.error.issues),
      });
      return;
    }

    captureIngestion
      .ingest({
        kind: "notification",
        userId,
        notification: parsed.data,
      })
      .catch(captureError);
  });

  return () => subscription.remove();
}
