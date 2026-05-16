import {
  assertCopAmount,
  assertIsoDate,
  assertIsoDateTime,
  assertMonth,
} from "@/shared/types/assertions";

export function assertRecordShape(
  row: unknown,
  key: string,
  validators: Record<string, (value: unknown) => void>,
  optionalKeys: readonly string[] = []
) {
  if (!isRecord(row)) {
    throw new Error("Malformed local ledger backup snapshot");
  }

  const expectedKeys = Object.keys(validators).sort();
  const actualKeys = Object.keys(row).sort();
  const requiredKeys = expectedKeys.filter((name) => !optionalKeys.includes(name));
  const missingKeys = requiredKeys.filter((name) => !actualKeys.includes(name));
  if (missingKeys.length > 0) {
    throw new Error(`Malformed local ledger backup row in ${key}: missing ${missingKeys[0]}`);
  }
  const extraKeys = actualKeys.filter((name) => !expectedKeys.includes(name));
  if (extraKeys.length > 0) {
    throw new Error(`Malformed local ledger backup row in ${key}: unexpected ${extraKeys[0]}`);
  }

  actualKeys.forEach((name) => {
    const validate = validators[name];
    if (validate === undefined) {
      throw new Error(`Malformed local ledger backup row in ${key}`);
    }
    validate(row[name]);
  });
}

export function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Malformed local ledger backup row: ${label} must be a non-empty string`);
  }
}

export function assertNullableString(value: unknown, label: string) {
  if (value !== null && typeof value !== "string") {
    throw new Error(`Malformed local ledger backup row: ${label} must be a string or null`);
  }
}

export function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Malformed local ledger backup row: ${label} must be a number`);
  }
}

export function assertNullableNumber(value: unknown, label: string) {
  if (value !== null) {
    assertNumber(value, label);
  }
}

export function assertBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Malformed local ledger backup row: ${label} must be a boolean`);
  }
}

export function assertCopAmountValue(value: unknown, label: string) {
  assertNumber(value, label);
  assertCopAmount(value);
}

export function assertValidIsoDate(value: unknown, label: string) {
  assertString(value, label);
  assertIsoDate(value);
}

export function assertValidIsoDateTime(value: unknown, label: string) {
  assertString(value, label);
  assertIsoDateTime(value);
}

export function assertNullableIsoDateTime(value: unknown, label: string) {
  if (value !== null) {
    assertValidIsoDateTime(value, label);
  }
}

export function assertValidMonth(value: unknown, label: string) {
  assertString(value, label);
  assertMonth(value);
}

export function assertOneOf(values: readonly string[], value: unknown, label: string) {
  assertString(value, label);
  if (!values.includes(value)) {
    throw new Error(`Malformed local ledger backup row: ${label} is not supported`);
  }
}

export function assertNullableOneOf(values: readonly string[], value: unknown, label: string) {
  if (value !== null) {
    assertOneOf(values, value, label);
  }
}

export const validateBaseLedgerFields = (validators: Record<string, (value: unknown) => void>) => ({
  ...validators,
  createdAt: (value: unknown) => assertValidIsoDateTime(value, "createdAt"),
  updatedAt: (value: unknown) => assertValidIsoDateTime(value, "updatedAt"),
  deletedAt: (value: unknown) => assertNullableIsoDateTime(value, "deletedAt"),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
