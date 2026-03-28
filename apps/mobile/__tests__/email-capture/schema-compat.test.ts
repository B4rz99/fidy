/**
 * Static schema compatibility test.
 *
 * Reads the Edge Function source as text and compares the JSON Schema
 * (FULL_PARSE_SCHEMA) and CATEGORY_IDS against the client Zod schema,
 * catching schema drift without any network calls.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { llmOutputSchema } from "@/features/email-capture/services/llm-parser";
import { CATEGORY_IDS } from "@/features/transactions/lib/categories";

const edgeFnSource = readFileSync(
  resolve(__dirname, "../../../../supabase/functions/parse-email/index.ts"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Regex extractors (pure functions)
// ---------------------------------------------------------------------------

/** Extract property keys from FULL_PARSE_SCHEMA.schema.properties */
function extractPropertyKeys(source: string): string[] {
  const propsMatch = source.match(
    /FULL_PARSE_SCHEMA\s*=\s*\{[\s\S]*?properties:\s*\{([\s\S]*?)\},\s*\n\s*required:/
  );
  if (!propsMatch) return [];
  const propsBlock = propsMatch[1] ?? "";
  // Match only top-level property keys: `keyName: { type:` pattern
  const keyMatches = propsBlock.matchAll(/(\w+)\s*:\s*\{/g);
  return [...keyMatches].map((m) => m[1] ?? "").filter(Boolean);
}

/** Extract required field names from FULL_PARSE_SCHEMA */
function extractRequired(source: string): string[] {
  const reqMatch = source.match(/FULL_PARSE_SCHEMA[\s\S]*?required:\s*\[([\s\S]*?)\]/);
  if (!reqMatch) return [];
  const reqBlock = reqMatch[1] ?? "";
  return [...reqBlock.matchAll(/"(\w+)"/g)].map((m) => m[1] ?? "").filter(Boolean);
}

/** Extract CATEGORY_IDS array values from the Edge Function source */
function extractCategoryIds(source: string): string[] {
  const catMatch = source.match(/const CATEGORY_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!catMatch) return [];
  const catBlock = catMatch[1] ?? "";
  return [...catBlock.matchAll(/"(\w+)"/g)].map((m) => m[1] ?? "").filter(Boolean);
}

/** Extract type enum values from FULL_PARSE_SCHEMA */
function extractTypeEnum(source: string): string[] {
  const typeMatch = source.match(
    /FULL_PARSE_SCHEMA[\s\S]*?type:\s*\{\s*type:\s*"string",\s*enum:\s*\[([\s\S]*?)\]/
  );
  if (!typeMatch) return [];
  const typeBlock = typeMatch[1] ?? "";
  return [...typeBlock.matchAll(/"(\w+)"/g)].map((m) => m[1] ?? "").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Edge Function ↔ client schema compatibility", () => {
  it("regex extractors find non-empty results (sanity check)", () => {
    expect(extractPropertyKeys(edgeFnSource).length).toBeGreaterThan(0);
    expect(extractRequired(edgeFnSource).length).toBeGreaterThan(0);
    expect(extractCategoryIds(edgeFnSource).length).toBeGreaterThan(0);
    expect(extractTypeEnum(edgeFnSource).length).toBeGreaterThan(0);
  });

  it("FULL_PARSE_SCHEMA property keys match llmOutputSchema shape", () => {
    const edgeKeys = extractPropertyKeys(edgeFnSource).sort();
    const clientKeys = Object.keys(llmOutputSchema.shape).sort();

    expect(edgeKeys).toEqual(clientKeys);
  });

  it("required fields match", () => {
    const edgeRequired = extractRequired(edgeFnSource).sort();
    const clientKeys = Object.keys(llmOutputSchema.shape).sort();

    // Every required field in the edge function should exist in the client schema
    expect(edgeRequired).toEqual(clientKeys);
  });

  it("CATEGORY_IDS match between Edge Function and client", () => {
    const edgeCategoryIds = extractCategoryIds(edgeFnSource);
    expect(edgeCategoryIds).toEqual(CATEGORY_IDS);
  });

  it("type enum values match", () => {
    const edgeTypeEnums = extractTypeEnum(edgeFnSource).sort();
    const clientTypeEnums = (llmOutputSchema.shape.type.options as string[]).slice().sort();

    expect(edgeTypeEnums).toEqual(clientTypeEnums);
  });
});
