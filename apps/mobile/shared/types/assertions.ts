import type {
  BillId,
  BudgetId,
  CategoryId,
  CopAmount,
  DetectedSmsEventId,
  EmailAccountId,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  Month,
  ProcessedEmailId,
  SyncConflictId,
  SyncQueueId,
  TransactionId,
  TransferId,
  UserId,
  UserMemoryId,
} from "@/shared/types/branded";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const ISO_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const MAX_OFFSET_MINUTES = 23 * 60 + 59;

type IsoDateParts = readonly [year: number, month: number, day: number];
type IsoTimeParts = readonly [hour: number, minute: number, second: number, milliseconds: number];
type IsoOffsetParts = readonly [hour: number, minute: number];
type Assertion<Value, AssertedValue extends Value> = (
  value: Value
) => asserts value is AssertedValue;

const isBlankString = (value: string) => value.trim().length === 0;

const assertNonEmptyString = (value: string, label: string) => {
  if (isBlankString(value)) {
    throw new Error(`${label} must be a non-empty string`);
  }
};

const toMilliseconds = (fraction: string | undefined) =>
  Number((fraction ?? "").slice(0, 3).padEnd(3, "0"));

const parseIsoDateParts = (value: string): IsoDateParts | null => {
  const match = ISO_DATE_PATTERN.exec(value);
  return match === null ? null : ([Number(match[1]), Number(match[2]), Number(match[3])] as const);
};

const isValidUtcDatePart = ([year, month, day]: IsoDateParts) => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const isValidIsoDateValue = (value: string) => {
  const date = parseIsoDateParts(value);
  return date === null ? false : isValidUtcDatePart(date);
};

const parseIsoDateTimeMatch = (value: string) => ISO_DATE_TIME_PATTERN.exec(value);

const toIsoDateParts = (match: RegExpExecArray): IsoDateParts =>
  [Number(match[1]), Number(match[2]), Number(match[3])] as const;

const toIsoTimeParts = (match: RegExpExecArray): IsoTimeParts =>
  [Number(match[4]), Number(match[5]), Number(match[6]), toMilliseconds(match[7])] as const;

const toIsoOffsetParts = (match: RegExpExecArray): IsoOffsetParts =>
  [Number(match[10] ?? "0"), Number(match[11] ?? "0")] as const;

const offsetMinutes = ([hour, minute]: IsoOffsetParts, sign: string | undefined) =>
  (sign === "-" ? -1 : 1) * (hour * 60 + minute);

const isValidIsoTimeParts = ([hour, minute, second]: IsoTimeParts) =>
  hour <= 23 && minute <= 59 && second <= 59;

const isValidIsoOffset = (match: RegExpExecArray) =>
  match[8] === "Z"
    ? true
    : (([hour, minute]) =>
        hour <= 23 &&
        minute <= 59 &&
        Math.abs(offsetMinutes([hour, minute], match[9])) <= MAX_OFFSET_MINUTES)(
        toIsoOffsetParts(match)
      );

const matchesUtcDate = (date: Date, [year, month, day]: IsoDateParts) =>
  date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

const matchesUtcTime = (date: Date, [hour, minute, second, milliseconds]: IsoTimeParts) =>
  date.getUTCHours() === hour &&
  date.getUTCMinutes() === minute &&
  date.getUTCSeconds() === second &&
  date.getUTCMilliseconds() === milliseconds;

const toUtcDateTime = (dateParts: IsoDateParts, timeParts: IsoTimeParts) =>
  new Date(
    Date.UTC(
      dateParts[0],
      dateParts[1] - 1,
      dateParts[2],
      timeParts[0],
      timeParts[1],
      timeParts[2],
      timeParts[3]
    )
  );

const matchesUtcDateTimeParts = (dateParts: IsoDateParts, timeParts: IsoTimeParts) => {
  const date = toUtcDateTime(dateParts, timeParts);
  return matchesUtcDate(date, dateParts) && matchesUtcTime(date, timeParts);
};

const matchesUtcDateTime = (match: RegExpExecArray) =>
  matchesUtcDateTimeParts(toIsoDateParts(match), toIsoTimeParts(match));

const isValidParsedIsoDateTime = (match: RegExpExecArray) =>
  isValidUtcDatePart(toIsoDateParts(match)) &&
  isValidIsoTimeParts(toIsoTimeParts(match)) &&
  isValidIsoOffset(match) &&
  matchesUtcDateTime(match);

const isValidIsoDateTimeValue = (value: string) => {
  const match = parseIsoDateTimeMatch(value);
  return match === null ? false : isValidParsedIsoDateTime(match);
};

const requireValue = <Value, AssertedValue extends Value>(
  value: Value,
  assertValue: Assertion<Value, AssertedValue>
): AssertedValue => {
  assertValue(value);
  return value;
};

export function assertUserId(value: string): asserts value is UserId {
  assertNonEmptyString(value, "userId");
}

export function assertTransactionId(value: string): asserts value is TransactionId {
  assertNonEmptyString(value, "transactionId");
}

export function assertTransferId(value: string): asserts value is TransferId {
  assertNonEmptyString(value, "transferId");
}

export function assertBillId(value: string): asserts value is BillId {
  assertNonEmptyString(value, "billId");
}

export function assertBudgetId(value: string): asserts value is BudgetId {
  assertNonEmptyString(value, "budgetId");
}

export function assertCategoryId(value: string): asserts value is CategoryId {
  assertNonEmptyString(value, "categoryId");
}

export function assertDetectedSmsEventId(value: string): asserts value is DetectedSmsEventId {
  assertNonEmptyString(value, "detectedSmsEventId");
}

export function assertEmailAccountId(value: string): asserts value is EmailAccountId {
  assertNonEmptyString(value, "emailAccountId");
}

export function assertFinancialAccountId(value: string): asserts value is FinancialAccountId {
  assertNonEmptyString(value, "financialAccountId");
}

export function assertProcessedEmailId(value: string): asserts value is ProcessedEmailId {
  assertNonEmptyString(value, "processedEmailId");
}

export function assertSyncConflictId(value: string): asserts value is SyncConflictId {
  assertNonEmptyString(value, "syncConflictId");
}

export function assertSyncQueueId(value: string): asserts value is SyncQueueId {
  assertNonEmptyString(value, "syncQueueId");
}

export function assertUserMemoryId(value: string): asserts value is UserMemoryId {
  assertNonEmptyString(value, "userMemoryId");
}

export function assertCopAmount(value: number): asserts value is CopAmount {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("amount must be a non-negative integer");
  }
}

export function assertMonth(value: string): asserts value is Month {
  if (!MONTH_PATTERN.test(value)) {
    throw new Error("month must be a valid YYYY-MM string");
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

export function requireUserId(value: string): UserId {
  return requireValue(value, assertUserId);
}

export function requireTransactionId(value: string): TransactionId {
  return requireValue(value, assertTransactionId);
}

export function requireTransferId(value: string): TransferId {
  return requireValue(value, assertTransferId);
}

export function requireProcessedEmailId(value: string): ProcessedEmailId {
  return requireValue(value, assertProcessedEmailId);
}

export function requireCopAmount(value: number): CopAmount {
  return requireValue(value, assertCopAmount);
}

export function requireBillId(value: string): BillId {
  return requireValue(value, assertBillId);
}

export function requireBudgetId(value: string): BudgetId {
  return requireValue(value, assertBudgetId);
}

export function requireCategoryId(value: string): CategoryId {
  return requireValue(value, assertCategoryId);
}

export function requireDetectedSmsEventId(value: string): DetectedSmsEventId {
  return requireValue(value, assertDetectedSmsEventId);
}

export function requireFinancialAccountId(value: string): FinancialAccountId {
  return requireValue(value, assertFinancialAccountId);
}

export function requireMonth(value: string): Month {
  return requireValue(value, assertMonth);
}

export function requireIsoDate(value: string): IsoDate {
  return requireValue(value, assertIsoDate);
}

export function requireIsoDateTime(value: string): IsoDateTime {
  return requireValue(value, assertIsoDateTime);
}

export function requireUserMemoryId(value: string): UserMemoryId {
  return requireValue(value, assertUserMemoryId);
}

export function requireSyncConflictId(value: string): SyncConflictId {
  return requireValue(value, assertSyncConflictId);
}

export function requireSyncQueueId(value: string): SyncQueueId {
  return requireValue(value, assertSyncQueueId);
}
