import { describe, expect, it } from "vitest";
import {
  interpretCaptureCandidate,
  validateCaptureCandidateForLocalLedger,
} from "@/features/capture-interpreter/public";

const VALID_CATEGORIES = ["food", "transport", "other"] as const;

function validateInterpretedCandidate(data: unknown) {
  const interpreted = interpretCaptureCandidate(data, { validCategoryIds: VALID_CATEGORIES });

  return interpreted.kind === "candidate"
    ? validateCaptureCandidateForLocalLedger(interpreted.candidate, {
        validCategoryIds: VALID_CATEGORIES,
      })
    : interpreted;
}

describe("Capture Interpreter candidates", () => {
  it("accepts a valid transaction candidate only after local ledger validation", () => {
    expect(
      validateInterpretedCandidate({
        kind: "transaction",
        type: "expense",
        amount: 50000,
        categoryId: "food",
        description: "Exito",
        date: "2026-04-24",
        confidence: 0.9,
        fromAccountHint: "Tarjeta credito Bancolombia",
        toAccountHint: null,
      })
    ).toEqual({
      kind: "accepted",
      transaction: {
        type: "expense",
        amount: 50000,
        categoryId: "food",
        description: "Exito",
        date: "2026-04-24",
        confidence: 0.9,
        fromAccountHint: "Tarjeta credito Bancolombia",
      },
    });
  });

  it("keeps ambiguous candidates out of local ledger writes", () => {
    const candidate = {
      kind: "needs_review",
      reason: "merchant and amount conflict",
      confidence: 0.4,
    } as const;
    const interpreted = interpretCaptureCandidate(candidate, {
      validCategoryIds: VALID_CATEGORIES,
    });

    expect(interpreted).toEqual({
      kind: "candidate",
      candidate: {
        kind: "needs_review",
        reason: "merchant and amount conflict",
        confidence: 0.4,
      },
    });

    expect(validateInterpretedCandidate(candidate)).toEqual({
      kind: "needs_review",
      reason: "merchant and amount conflict",
    });
  });

  it("routes transfer candidates with null account hints to review", () => {
    const payload = {
      kind: "transfer",
      amount: 50000,
      description: "Transferencia entre cuentas",
      date: "2026-04-24",
      confidence: 0.8,
      fromAccountHint: null,
      toAccountHint: null,
    };
    const interpreted = interpretCaptureCandidate(payload, {
      validCategoryIds: VALID_CATEGORIES,
    });

    expect(interpreted).toEqual({
      kind: "candidate",
      candidate: {
        kind: "transfer",
        amount: 50000,
        description: "Transferencia entre cuentas",
        date: "2026-04-24",
        confidence: 0.8,
      },
    });
    expect(validateInterpretedCandidate(payload)).toEqual({
      kind: "needs_review",
      reason: "transfer candidates require account resolution",
    });
  });

  it("rejects malformed AI candidate payloads before local validation", () => {
    expect(
      interpretCaptureCandidate(
        {
          kind: "transaction",
          type: "expense",
          amount: "50000",
          categoryId: "food",
          description: "Exito",
          date: "2026-04-24",
          confidence: 0.9,
        },
        { validCategoryIds: VALID_CATEGORIES }
      )
    ).toEqual({
      kind: "invalid",
      reasons: expect.arrayContaining(["Invalid input: expected number, received string"]),
    });
  });

  it("rejects transaction candidates that fail deterministic local ledger validation", () => {
    expect(
      validateInterpretedCandidate({
        kind: "transaction",
        type: "expense",
        amount: 50000,
        categoryId: "remote-only-category",
        description: "Exito",
        date: "2026-04-24",
        confidence: 0.9,
      })
    ).toEqual({
      kind: "rejected",
      reason: "categoryId is not a local ledger category",
    });
  });

  it("rejects zero amount transaction candidates before they reach the parser schema", () => {
    expect(
      validateInterpretedCandidate({
        kind: "transaction",
        type: "expense",
        amount: 0,
        categoryId: "food",
        description: "Exito",
        date: "2026-04-24",
        confidence: 0.9,
      })
    ).toEqual({
      kind: "rejected",
      reason: "amount must be greater than zero",
    });
  });
});
