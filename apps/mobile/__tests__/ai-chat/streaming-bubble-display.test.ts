import { describe, expect, it } from "vitest";
import { getStreamingBubbleDisplay } from "@/features/ai-chat/lib/streaming-bubble-display";

describe("AI chat streaming bubble display", () => {
  it("shows a thinking state before the first streamed token", () => {
    expect(getStreamingBubbleDisplay("", "Fidy is thinking")).toEqual({
      phase: "waiting",
      label: "Fidy is thinking",
    });
  });

  it("shows streamed content after tokens arrive", () => {
    expect(getStreamingBubbleDisplay("Here is your answer", "Fidy is thinking")).toEqual({
      phase: "streaming",
      content: "Here is your answer",
    });
  });
});
