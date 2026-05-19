import { describe, expect, it } from "vitest";
import {
  shouldAutoScrollForContentChange,
  shouldShowScrollToBottom,
} from "@/features/ai-chat/lib/conversation-scroll";

describe("AI chat conversation scroll policy", () => {
  it("auto-scrolls when content grows while the reader is near the bottom", () => {
    expect(
      shouldAutoScrollForContentChange({
        previousContentHeight: 900,
        nextContentHeight: 960,
        viewportHeight: 500,
        scrollOffsetY: 430,
        bottomInset: 80,
      })
    ).toBe(true);
  });

  it("preserves scroll position when content grows while reading older messages", () => {
    expect(
      shouldAutoScrollForContentChange({
        previousContentHeight: 900,
        nextContentHeight: 960,
        viewportHeight: 500,
        scrollOffsetY: 100,
        bottomInset: 80,
      })
    ).toBe(false);
  });

  it("shows a scroll-to-bottom affordance only away from the bottom", () => {
    expect(
      shouldShowScrollToBottom({
        contentHeight: 1200,
        viewportHeight: 500,
        scrollOffsetY: 300,
        bottomInset: 80,
      })
    ).toBe(true);

    expect(
      shouldShowScrollToBottom({
        contentHeight: 1200,
        viewportHeight: 500,
        scrollOffsetY: 730,
        bottomInset: 80,
      })
    ).toBe(false);
  });

  it("does not double count list bottom inset already included in content height", () => {
    expect(
      shouldShowScrollToBottom({
        contentHeight: 1200,
        viewportHeight: 500,
        scrollOffsetY: 660,
        bottomInset: 80,
      })
    ).toBe(false);
  });
});
