import type {
  CopAmount,
  EmailAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function assertNonEmptyString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function toMilliseconds(fraction: string | undefined): number {
  return Number((fraction ?? "").slice(0, 3).padEnd(3, "0"));
}

function isValidUtcDatePart(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isValidIsoDateValue(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return isValidUtcDatePart(year, month, day);
}

function isValidIsoDateTimeValue(value: string): boolean {
  const match = ISO_DATE_TIME_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const milliseconds = toMilliseconds(match[7]);
  const zone = match[8];
  const offsetSign = match[9] === "-" ? -1 : 1;
  const offsetHour = Number(match[10] ?? "0");
  const offsetMinute = Number(match[11] ?? "0");

  if (
    !isValidUtcDatePart(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return false;
  }

  if (zone !== "Z") {
    const offsetMinutes = offsetSign * (offsetHour * 60 + offsetMinute);

    if (offsetMinutes < -23 * 60 - 59 || offsetMinutes > 23 * 60 + 59) {
      return false;
    }
  }

  const dateAtUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second, milliseconds));

  return (
    dateAtUtc.getUTCFullYear() === year &&
    dateAtUtc.getUTCMonth() === month - 1 &&
    dateAtUtc.getUTCDate() === day &&
    dateAtUtc.getUTCHours() === hour &&
    dateAtUtc.getUTCMinutes() === minute &&
    dateAtUtc.getUTCSeconds() === second &&
    dateAtUtc.getUTCMilliseconds() === milliseconds
  );
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
  if (!isValidIsoDateValue(value)) {
    throw new Error("date must be a valid ISO calendar date");
  }
}

export function assertIsoDateTime(value: string): asserts value is IsoDateTime {
  if (!isValidIsoDateTimeValue(value)) {
    throw new Error("datetime must be a valid ISO 8601 timestamp");
  }
}
