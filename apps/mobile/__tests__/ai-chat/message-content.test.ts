import { describe, expect, it } from "vitest";
import {
  getAssistantDisplayBlocks,
  getPlainMessageText,
} from "@/features/ai-chat/lib/message-content";

describe("AI chat message content", () => {
  it("removes action payloads from visible message text", () => {
    expect(getPlainMessageText('Added it.\n\n[ACTION]{"type":"add"}[/ACTION]')).toBe("Added it.");
  });

  it("turns assistant markdown into display blocks without raw markdown markers", () => {
    expect(getAssistantDisplayBlocks("You spent **120,000 COP**.\n\n- Food\n- Transport")).toEqual([
      {
        key: "paragraph-0-0",
        type: "paragraph",
        segments: [
          { key: "text-0-0", text: "You spent ", strong: false },
          { key: "strong-0-1", text: "120,000 COP", strong: true },
          { key: "text-0-2", text: ".", strong: false },
        ],
      },
      { key: "list-1-0", type: "bullet", text: "Food" },
      { key: "list-1-1", type: "bullet", text: "Transport" },
    ]);
  });

  it("keeps non-markdown asterisks in visible assistant text", () => {
    expect(getAssistantDisplayBlocks("The formula is 2 * 3 * 4.")[0]).toEqual({
      key: "paragraph-0-0",
      type: "paragraph",
      segments: [{ key: "text-0-0", text: "The formula is 2 * 3 * 4.", strong: false }],
    });
  });

  it("strips nested inline markers from bold segments", () => {
    expect(getAssistantDisplayBlocks("You spent **`120,000 COP`** today.")[0]).toEqual({
      key: "paragraph-0-0",
      type: "paragraph",
      segments: [
        { key: "text-0-0", text: "You spent ", strong: false },
        { key: "strong-0-1", text: "120,000 COP", strong: true },
        { key: "text-0-2", text: " today.", strong: false },
      ],
    });
  });

  it("preserves mixed paragraphs and bullets in order", () => {
    expect(
      getAssistantDisplayBlocks("Here are the categories:\n- Food\n- Transport\nDone.")
    ).toEqual([
      {
        key: "paragraph-0-0",
        type: "paragraph",
        segments: [{ key: "text-0-0", text: "Here are the categories:", strong: false }],
      },
      { key: "list-0-1", type: "bullet", text: "Food" },
      { key: "list-0-2", type: "bullet", text: "Transport" },
      {
        key: "paragraph-0-3",
        type: "paragraph",
        segments: [{ key: "text-3-0", text: "Done.", strong: false }],
      },
    ]);
  });
});
