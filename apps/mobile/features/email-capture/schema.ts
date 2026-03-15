import { z } from "zod";

export const emailProviderSchema = z.enum(["gmail", "outlook"]);
export type EmailProvider = z.infer<typeof emailProviderSchema>;

export const processedEmailStatusSchema = z.enum([
  "success",
  "failed",
  "skipped",
  "skipped_duplicate",
  "needs_review",
  "pending_retry",
]);
export type ProcessedEmailStatus = z.infer<typeof processedEmailStatusSchema>;

export const rawEmailSchema = z.object({
  externalId: z.string(),
  from: z.string().email(),
  subject: z.string(),
  body: z.string(),
  receivedAt: z.string(),
  provider: emailProviderSchema,
});
export type RawEmail = z.infer<typeof rawEmailSchema>;

export const transactionSourceSchema = z.enum([
  "manual",
  "email_gmail",
  "email_outlook",
  "notification_android",
  "google_pay",
  "apple_pay",
  "sms_detected",
]);
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

export const EMAIL_REDIRECT_URI = "fidy://email/callback";

/** Lazy env accessors — must use static process.env.X access for Metro inlining. */
export function getGmailClientId(): string {
  const value = process.env.EXPO_PUBLIC_GMAIL_CLIENT_ID;
  if (!value) throw new Error("Missing EXPO_PUBLIC_GMAIL_CLIENT_ID");
  return value;
}

export function getGmailRedirectUri(): string {
  const clientId = getGmailClientId();
  return `com.googleusercontent.apps.${clientId.split(".")[0]}:/oauth2redirect`;
}

export function getOutlookClientId(): string {
  const value = process.env.EXPO_PUBLIC_OUTLOOK_CLIENT_ID;
  if (!value) throw new Error("Missing EXPO_PUBLIC_OUTLOOK_CLIENT_ID");
  return value;
}

export type ConnectResult = { success: true; email: string } | { success: false; error: string };
