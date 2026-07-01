export const TRANSACTION_SOURCES = [
  "manual",
  "email_capture",
  "notification_capture",
  "widget_capture",
  "apple_pay_capture",
  "cloud_ledger",
] as const;

export type NormalizedTransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const TRANSFER_SOURCES = ["manual", "capture-match", "review-confirmation"] as const;

export type TransferSource = (typeof TRANSFER_SOURCES)[number];

export const LEDGER_CACHE_REFERENCE_SOURCES = ["local_ledger", "cloud_ledger"] as const;

export type LedgerCacheReferenceSource = (typeof LEDGER_CACHE_REFERENCE_SOURCES)[number];
