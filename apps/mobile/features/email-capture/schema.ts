import { z } from "zod";

export const emailProviderSchema = z.enum(["gmail", "outlook"]);
export type EmailProvider = z.infer<typeof emailProviderSchema>;

export const processedEmailStatusSchema = z.enum([
  "success",
  "failed",
  "skipped_duplicate",
  "needs_review",
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

export const transactionSourceSchema = z.enum(["manual", "email_gmail", "email_outlook"]);
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

export const EMAIL_REDIRECT_URI = "fidy://email/callback";

export const GMAIL_CLIENT_ID = process.env.EXPO_PUBLIC_GMAIL_CLIENT_ID ?? "";
export const GMAIL_REDIRECT_URI = `com.googleusercontent.apps.${GMAIL_CLIENT_ID.split(".")[0]}:/oauth2redirect`;
export const OUTLOOK_CLIENT_ID = process.env.EXPO_PUBLIC_OUTLOOK_CLIENT_ID ?? "";

export type ConnectResult = { success: true; email: string } | { success: false; error: string };
