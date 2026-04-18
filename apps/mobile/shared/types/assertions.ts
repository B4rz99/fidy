import type {
  CopAmount,
  EmailAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

function assertNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function assertUserId(value: string): asserts value is UserId {
  assertNonEmptyString(value, "userId");
}

export function assertTransactionId(value: string): asserts value is TransactionId {
  assertNonEmptyString(value, "transactionId");
}

export function assertEmailAccountId(value: string): asserts value is EmailAccountId {
  assertNonEmptyString(value, "emailAccountId");
}

export function assertProcessedEmailId(value: string): asserts value is ProcessedEmailId {
  assertNonEmptyString(value, "processedEmailId");
}

export function assertCopAmount(value: number): asserts value is CopAmount {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("amount must be a non-negative integer");
  }
}

export function assertIsoDate(value: string): asserts value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("date must be in YYYY-MM-DD format");
  }
}

export function assertIsoDateTime(value: string): asserts value is IsoDateTime {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error("datetime must be a valid ISO timestamp");
  }
}
