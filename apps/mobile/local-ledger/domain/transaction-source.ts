export const TRANSACTION_SOURCES = [
  "manual",
  "email_capture",
  "notification_capture",
  "widget_capture",
  "apple_pay_capture",
] as const;

export type LocalLedgerTransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const isTransactionSource = (source: string): source is LocalLedgerTransactionSource =>
  TRANSACTION_SOURCES.includes(source as LocalLedgerTransactionSource);

export const normalizeTransactionSource = (
  source: string | null | undefined
): LocalLedgerTransactionSource => {
  if (source == null) return "manual";
  if (isTransactionSource(source)) return source;
  throw new Error(`Unsupported transaction source: ${source}`);
};
