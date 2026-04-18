import { describe, expect, test } from "vitest";
import { assertIsoDate, assertIsoDateTime } from "@/shared/types/assertions";

describe("temporal assertions", () => {
  test("assertIsoDate accepts valid calendar dates", () => {
    expect(() => assertIsoDate("2024-02-29")).not.toThrow();
    expect(() => assertIsoDate("2026-12-31")).not.toThrow();
  });

  test("assertIsoDate rejects impossible calendar dates", () => {
    expect(() => assertIsoDate("2024-02-30")).toThrow("date must be a valid ISO calendar date");
    expect(() => assertIsoDate("2024-13-01")).toThrow("date must be a valid ISO calendar date");
    expect(() => assertIsoDate("2024-00-10")).toThrow("date must be a valid ISO calendar date");
  });

  test("assertIsoDateTime accepts strict ISO timestamps", () => {
    expect(() => assertIsoDateTime("2024-01-01T12:34:56Z")).not.toThrow();
    expect(() => assertIsoDateTime("2024-01-01T12:34:56.789Z")).not.toThrow();
    expect(() => assertIsoDateTime("2024-01-01T12:34:56+05:30")).not.toThrow();
  });

  test("assertIsoDateTime rejects non-ISO or impossible timestamps", () => {
    expect(() => assertIsoDateTime("Mon, 01 Jan 2024 12:00:00 GMT")).toThrow(
      "datetime must be a valid ISO 8601 timestamp"
    );
    expect(() => assertIsoDateTime("2024-01-01 12:00:00Z")).toThrow(
      "datetime must be a valid ISO 8601 timestamp"
    );
    expect(() => assertIsoDateTime("2024-02-30T12:00:00Z")).toThrow(
      "datetime must be a valid ISO 8601 timestamp"
    );
    expect(() => assertIsoDateTime("2024-01-01T24:00:00Z")).toThrow(
      "datetime must be a valid ISO 8601 timestamp"
    );
  });
});
