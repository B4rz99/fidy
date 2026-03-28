import { z } from "zod";

export const notificationDataSchema = z.object({
  packageName: z.string(),
  title: z.string().optional(),
  text: z.string(),
  subText: z.string().optional(),
  bigText: z.string().optional(),
  timestamp: z.number(),
});
export type NotificationData = z.infer<typeof notificationDataSchema>;

export const applePayIntentDataSchema = z.object({
  amount: z.number().positive(),
  merchant: z.string().min(1),
  card: z.string().optional(),
});
export type ApplePayIntentData = z.infer<typeof applePayIntentDataSchema>;

export const smsDetectionDataSchema = z.object({
  senderName: z.string().min(1),
  timestamp: z.string(),
});
export type SmsDetectionData = z.infer<typeof smsDetectionDataSchema>;

export const KNOWN_BANK_PACKAGES: readonly {
  packageName: string;
  label: string;
}[] = [
  { packageName: "com.todo1.mobile.co.bancolombia", label: "Bancolombia" },
  { packageName: "com.bbva.nxt_colombia", label: "BBVA Colombia" },
  { packageName: "com.davivienda.daviplataapp", label: "Daviplata" },
  { packageName: "com.nequi.MobileApp", label: "Nequi" },
  {
    packageName: "com.google.android.apps.walletnfcrel",
    label: "Google Wallet",
  },
  { packageName: "com.rappi.card", label: "RappiCard" },
];

export const KNOWN_BANK_SMS_SENDERS = [
  "Bancolombia",
  "BBVA",
  "Davivienda",
  "Nequi",
  "Daviplata",
  "RappiCard",
] as const;

/**
 * Resolves the transaction source based on Android package name.
 * Google Wallet gets its own source; everything else is notification_android.
 */
export function resolveSource(packageName: string): "google_pay" | "notification_android" {
  return packageName === "com.google.android.apps.walletnfcrel"
    ? "google_pay"
    : "notification_android";
}
