import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../features/ai-chat/hooks/use-streaming-chat.ts"),
  "utf8"
);

describe("streaming chat context packet source", () => {
  it("keeps saved memory enrichment best-effort and capped", () => {
    expect(source).toContain("const MAX_CONTEXT_MEMORIES = 20");
    expect(source).toContain("listUserMemories(input.userId).catch(() => [])");
    expect(source).toContain("memories.slice(0, MAX_CONTEXT_MEMORIES).map");
  });
});
