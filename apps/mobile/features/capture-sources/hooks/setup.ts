import {
  addDetectBankSmsListener,
  addLogTransactionListener,
  isAvailable,
} from "@/modules/expo-app-intents";
import type { AnyDb } from "@/shared/db/client";
import { generateId } from "@/shared/lib/generate-id";
import { insertDetectedSmsEvent } from "../lib/repository";
import { processApplePayIntent } from "../services/apple-pay-pipeline";
import { processNotification } from "../services/notification-pipeline";

const noop = () => {};

export function setupApplePayCapture(db: AnyDb, userId: string): () => void {
  if (!isAvailable()) return noop;

  const subscription = addLogTransactionListener((event) => {
    processApplePayIntent(db, userId, event).catch(() => {});
  });

  return () => subscription.remove();
}

export function setupSmsDetection(
  db: AnyDb,
  userId: string,
  refreshDetectedSms: () => void
): () => void {
  if (!isAvailable()) return noop;

  const subscription = addDetectBankSmsListener((event) => {
    insertDetectedSmsEvent(db, {
      id: generateId("sms"),
      userId,
      senderLabel: event.senderName,
      detectedAt: event.timestamp,
      dismissed: false,
      linkedTransactionId: null,
      createdAt: new Date().toISOString(),
    }).catch(() => {});
    refreshDetectedSms();
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
      () => {}
    );
  });

  return () => subscription.remove();
}
