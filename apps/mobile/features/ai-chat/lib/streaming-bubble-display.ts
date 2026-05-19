export type StreamingBubbleDisplay =
  | { readonly phase: "waiting"; readonly label: string }
  | { readonly phase: "streaming"; readonly content: string };

export const getStreamingBubbleDisplay = (
  content: string,
  thinkingLabel: string
): StreamingBubbleDisplay => {
  const trimmedContent = content.trim();
  return trimmedContent
    ? { phase: "streaming", content }
    : { phase: "waiting", label: thinkingLabel };
};
