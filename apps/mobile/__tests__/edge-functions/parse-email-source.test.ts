import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const parseEmailSource = readFileSync(
  resolve(__dirname, "../../../../supabase/functions/parse-email/index.ts"),
  "utf-8"
);

describe("parse-email Edge Function source", () => {
  it("does not send unsupported GPT-5 sampling parameters", () => {
    expect(parseEmailSource).toContain('model: "gpt-5-nano-2025-08-07"');
    expect(parseEmailSource).not.toContain("temperature:");
  });

  it("keeps a deterministic seed and sanitized OpenAI error diagnostics", () => {
    expect(parseEmailSource).toContain("const LLM_SEED = 0");
    expect(parseEmailSource).toContain("seed: LLM_SEED");
    expect(parseEmailSource).toContain('return ["openai_error", status, code, param, type]');
  });

  it("keeps initial sync on a higher scoped rate limit than default parsing", () => {
    expect(parseEmailSource).toContain("const DEFAULT_RATE_LIMIT_PER_MINUTE = 20");
    expect(parseEmailSource).toContain("const INITIAL_SYNC_RATE_LIMIT_PER_MINUTE = 90");
    expect(parseEmailSource).toContain('parseContext === "initial_sync"');
    expect(parseEmailSource).toContain('"parse-email:initial-sync"');
  });

  it("keeps account evidence separate from merchant and counterparty fields", () => {
    expect(parseEmailSource).toContain("cardProductHint");
    expect(parseEmailSource).toContain("accountTypeHint");
    expect(parseEmailSource).toContain("merchant/payee goes in description");
    expect(parseEmailSource).toContain("never in account fields");
    expect(parseEmailSource).toContain("if unsure, return null");
  });
});
