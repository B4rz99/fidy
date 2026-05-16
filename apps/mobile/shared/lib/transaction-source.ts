export const TRANSACTION_SOURCES = [
  "manual",
  "email_capture",
  "notification_capture",
  "widget_capture",
  "apple_pay_capture",
] as const;

export type NormalizedTransactionSource = (typeof TRANSACTION_SOURCES)[number];

const legacyAutomatedSourceMap: Record<string, NormalizedTransactionSource> = {
  automated: "email_capture",
  email: "email_capture",
  email_gmail: "email_capture",
  email_outlook: "email_capture",
  google_pay: "notification_capture",
  notification: "notification_capture",
  notification_android: "notification_capture",
  google_wallet: "notification_capture",
  widget: "widget_capture",
  apple_pay: "apple_pay_capture",
};

export const isTransactionSource = (source: string): source is NormalizedTransactionSource =>
  TRANSACTION_SOURCES.includes(source as NormalizedTransactionSource);

export const normalizeTransactionSource = (
  source: string | null | undefined
): NormalizedTransactionSource =>
  source == null
    ? "manual"
    : isTransactionSource(source)
      ? source
      : (legacyAutomatedSourceMap[source] ?? "email_capture");
