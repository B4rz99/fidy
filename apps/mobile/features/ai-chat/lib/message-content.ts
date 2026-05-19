import { ACTION_BLOCK_REGEX } from "./parse-action";

export type AssistantTextSegment = {
  readonly key: string;
  readonly text: string;
  readonly strong: boolean;
};

export type AssistantDisplayBlock =
  | {
      readonly key: string;
      readonly type: "paragraph";
      readonly segments: readonly AssistantTextSegment[];
    }
  | {
      readonly key: string;
      readonly type: "bullet";
      readonly text: string;
    };

export const getPlainMessageText = (content: string): string =>
  content.replace(ACTION_BLOCK_REGEX, "").trim();

const stripInlineMarkdown = (text: string): string =>
  text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\*)\*([^\s*](?:[^*]*?[^\s*])?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

const toParagraphSegments = (text: string, blockIndex: number): readonly AssistantTextSegment[] => {
  const matches = [...text.matchAll(/\*\*([^*]+)\*\*/g)];
  if (matches.length === 0) {
    return [{ key: `text-${blockIndex}-0`, text: stripInlineMarkdown(text), strong: false }];
  }

  const reduced = matches.reduce<{
    readonly cursor: number;
    readonly segments: readonly { readonly text: string; readonly strong: boolean }[];
  }>(
    (state, match) => {
      const matchIndex = match.index ?? 0;
      const plainPrefix = text.slice(state.cursor, matchIndex);
      const strongText = match[1] ?? "";
      const nextSegments = plainPrefix
        ? [...state.segments, { text: stripInlineMarkdown(plainPrefix), strong: false }]
        : state.segments;
      return {
        cursor: matchIndex + match[0].length,
        segments: [...nextSegments, { text: stripInlineMarkdown(strongText), strong: true }],
      };
    },
    { cursor: 0, segments: [] }
  );

  return [
    ...reduced.segments,
    { text: stripInlineMarkdown(text.slice(reduced.cursor)), strong: false },
  ]
    .filter((segment) => segment.text.length > 0)
    .map((segment, segmentIndex) => ({
      key: `${segment.strong ? "strong" : "text"}-${blockIndex}-${segmentIndex}`,
      text: segment.text,
      strong: segment.strong,
    }));
};

const toDisplayBlock = (block: string, blockIndex: number): readonly AssistantDisplayBlock[] => {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, lineIndex) => {
    const bulletText = line.match(/^[-*]\s+(.+)$/)?.[1];
    if (bulletText) {
      return {
        key: `list-${blockIndex}-${lineIndex}`,
        type: "bullet" as const,
        text: stripInlineMarkdown(bulletText).trim(),
      };
    }

    return {
      key: `paragraph-${blockIndex}-${lineIndex}`,
      type: "paragraph" as const,
      segments: toParagraphSegments(line, blockIndex * 100 + lineIndex),
    };
  });
};

export const getAssistantDisplayBlocks = (content: string): readonly AssistantDisplayBlock[] =>
  getPlainMessageText(content)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap(toDisplayBlock);
