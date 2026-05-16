import type { RowSpec } from "./row-shape";
import {
  assertNullableIsoDateTime,
  assertNullableNumber,
  assertNullableString,
  assertOneOf,
  assertRecordShape,
  assertString,
  assertValidIsoDateTime,
  validateBaseLedgerFields,
} from "./row-assertions";

export const INTAKE_ROW_SPECS: readonly RowSpec[] = [
  {
    key: "processedCaptures",
    validate: (row) =>
      assertRecordShape(row, "processedCaptures", {
        id: (value) => assertString(value, "id"),
        fingerprintHash: (value) => assertString(value, "fingerprintHash"),
        source: (value) => assertString(value, "source"),
        status: (value) => assertString(value, "status"),
        rawText: (value) => assertNullableString(value, "rawText"),
        transactionId: (value) => assertNullableString(value, "transactionId"),
        confidence: (value) => assertNullableNumber(value, "confidence"),
        receivedAt: (value) => assertValidIsoDateTime(value, "receivedAt"),
        createdAt: (value) => assertValidIsoDateTime(value, "createdAt"),
      }),
  },
  {
    key: "processedSourceEvents",
    validate: (row) =>
      assertRecordShape(
        row,
        "processedSourceEvents",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          sourceFamily: (value) => assertString(value, "sourceFamily"),
          sourceId: (value) => assertString(value, "sourceId"),
          sourceEventId: (value) => assertString(value, "sourceEventId"),
          status: (value) => assertString(value, "status"),
          failureReason: (value) => assertNullableString(value, "failureReason"),
          receivedAt: (value) => assertValidIsoDateTime(value, "receivedAt"),
          processedAt: (value) => assertValidIsoDateTime(value, "processedAt"),
        })
      ),
  },
  {
    key: "reviewCandidates",
    validate: (row) =>
      assertRecordShape(
        row,
        "reviewCandidates",
        validateBaseLedgerFields({
          id: (value) => assertString(value, "id"),
          userId: (value) => assertString(value, "userId"),
          processedSourceEventId: (value) => assertString(value, "processedSourceEventId"),
          status: (value) => assertString(value, "status"),
          candidateKind: (value) => assertString(value, "candidateKind"),
          occurredAt: (value) => assertNullableIsoDateTime(value, "occurredAt"),
          amount: (value) => assertNullableNumber(value, "amount"),
          currency: (value) => assertOneOf(["COP"], value, "currency"),
          description: (value) => assertNullableString(value, "description"),
          confidence: (value) => assertNullableNumber(value, "confidence"),
        })
      ),
  },
  {
    key: "reviewCandidateCaptureEvidence",
    validate: (row) =>
      assertRecordShape(row, "reviewCandidateCaptureEvidence", {
        id: (value) => assertString(value, "id"),
        userId: (value) => assertString(value, "userId"),
        reviewCandidateId: (value) => assertString(value, "reviewCandidateId"),
        captureEvidenceId: (value) => assertString(value, "captureEvidenceId"),
        createdAt: (value) => assertValidIsoDateTime(value, "createdAt"),
        deletedAt: (value) => assertNullableIsoDateTime(value, "deletedAt"),
      }),
  },
];
