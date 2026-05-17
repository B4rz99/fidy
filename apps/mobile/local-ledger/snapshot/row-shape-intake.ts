import type { RowSpec } from "./row-shape";
import {
  assertNullableIsoDate,
  assertNullableIsoDateTime,
  assertNullableNumber,
  assertNullableOneOf,
  assertNullableString,
  assertOneOf,
  assertRecordShape,
  assertString,
  assertValidIsoDateTime,
  validateBaseLedgerFields,
} from "./row-assertions";

export const INTAKE_ROW_SPECS: readonly RowSpec[] = [
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
          status: (value) =>
            assertOneOf(
              ["processed", "needs_review", "failed", "duplicate", "dismissed", "pending_retry"],
              value,
              "status"
            ),
          failureReason: (value) => assertNullableString(value, "failureReason"),
          retryCount: (value) => assertNullableNumber(value, "retryCount"),
          nextRetryAt: (value) => assertNullableIsoDateTime(value, "nextRetryAt"),
          transactionId: (value) => assertNullableString(value, "transactionId"),
          confidence: (value) => assertNullableNumber(value, "confidence"),
          receivedAt: (value) => assertValidIsoDateTime(value, "receivedAt"),
          processedAt: (value) => assertValidIsoDateTime(value, "processedAt"),
        }),
        ["retryCount", "nextRetryAt", "transactionId", "confidence"]
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
          occurredAt: (value) => assertNullableIsoDate(value, "occurredAt"),
          amount: (value) => assertNullableNumber(value, "amount"),
          currency: (value) => assertOneOf(["COP"], value, "currency"),
          transactionType: (value) =>
            assertNullableOneOf(["expense", "income"], value, "transactionType"),
          categoryId: (value) => assertNullableString(value, "categoryId"),
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
