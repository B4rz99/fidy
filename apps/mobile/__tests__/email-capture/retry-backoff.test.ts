import { describe, expect, it } from "vitest";
import { computeNextRetryAt, isMaxRetriesReached } from "@/features/email-capture/lib/retry-backoff";

const FIXED_NOW = new Date("2026-03-15T12:00:00.000Z");

describe("computeNextRetryAt", () => {
  it("returns now + 1 minute for retryCount 0", () => {
    const result = computeNextRetryAt(0, FIXED_NOW);
    expect(result).toBe(new Date(FIXED_NOW.getTime() + 1 * 60_000).toISOString());
  });

  it("returns now + 5 minutes for retryCount 1", () => {
    const result = computeNextRetryAt(1, FIXED_NOW);
    expect(result).toBe(new Date(FIXED_NOW.getTime() + 5 * 60_000).toISOString());
  });

  it("returns now + 15 minutes for retryCount 2", () => {
    const result = computeNextRetryAt(2, FIXED_NOW);
    expect(result).toBe(new Date(FIXED_NOW.getTime() + 15 * 60_000).toISOString());
  });

  it("returns now + 60 minutes for retryCount 3", () => {
    const result = computeNextRetryAt(3, FIXED_NOW);
    expect(result).toBe(new Date(FIXED_NOW.getTime() + 60 * 60_000).toISOString());
  });

  it("returns now + 240 minutes for retryCount 4", () => {
    const result = computeNextRetryAt(4, FIXED_NOW);
    expect(result).toBe(new Date(FIXED_NOW.getTime() + 240 * 60_000).toISOString());
  });

  it("clamps to last backoff value for retryCount beyond array length", () => {
    const result = computeNextRetryAt(10, FIXED_NOW);
    expect(result).toBe(new Date(FIXED_NOW.getTime() + 240 * 60_000).toISOString());
  });
});

describe("isMaxRetriesReached", () => {
  it("returns false for retryCount 4", () => {
    expect(isMaxRetriesReached(4)).toBe(false);
  });

  it("returns true for retryCount 5", () => {
    expect(isMaxRetriesReached(5)).toBe(true);
  });

  it("returns true for retryCount above 5", () => {
    expect(isMaxRetriesReached(10)).toBe(true);
  });
});
