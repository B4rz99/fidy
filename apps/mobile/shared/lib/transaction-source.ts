export const TRANSACTION_SOURCES = [
  "manual",
  "email_capture",
  "notification_capture",
  "widget_capture",
  "apple_pay_capture",
] as const;

export type NormalizedTransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const isTransactionSource = (source: string): source is NormalizedTransactionSource =>
  TRANSACTION_SOURCES.includes(source as NormalizedTransactionSource);

export const normalizeTransactionSource = (
  source: string | null | undefined
): NormalizedTransactionSource => {
  if (source == null) return "manual";
  if (isTransactionSource(source)) return source;
  throw new Error(`Unsupported transaction source: ${source}`);
};
