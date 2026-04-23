import { describe, expect, it } from "bun:test";
import {
  extractTextContent,
  MONITORED_TOOLS,
  normalizeHookInput,
} from "./post-tool-defender-hook";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS helper for OpenCode.
const { scanForInjections: scanForInjectionsJs } = require("./post-tool-defender-lib.js");

const config = {
  rolePlayingPatterns: [
    {
      pattern: "\\bDAN\\s+(mode|persona|character|version)\\b",
      reason: "DAN mode activation attempt",
      severity: "high",
    },
  ],
};

describe("scanForInjections", () => {
  it("detects short prompt injection payloads in the OpenCode helper", () => {
    expect(scanForInjectionsJs("DAN mode", config)).toEqual([
      ["Role-Playing/DAN", "DAN mode activation attempt", "high"],
    ]);
  });
});

describe("normalizeHookInput", () => {
  it("normalizes valid hook payloads", () => {
    expect(
      normalizeHookInput({
        tool_name: "Read",
        tool_input: { file_path: "/tmp/file.txt" },
        tool_response: "content",
      })
    ).toEqual({
      toolName: "Read",
      toolInput: { file_path: "/tmp/file.txt" },
      toolResponse: "content",
      toolResult: undefined,
    });
  });

  it("rejects malformed hook payloads", () => {
    expect(normalizeHookInput({ tool_name: "Read", tool_input: null })).toBeNull();
    expect(normalizeHookInput({ tool_name: 42, tool_input: {} })).toBeNull();
  });
});

describe("extractTextContent", () => {
  it("joins structured content blocks", () => {
    expect(
      extractTextContent({
        content: ["first", { text: "second" }, { ignored: true }],
      })
    ).toBe("first\nsecond");
  });

  it("normalizes nested array results", () => {
    expect(
      extractTextContent([
        { stdout: "alpha" },
        ["beta", { content: [{ text: "gamma" }] }],
      ])
    ).toBe("alpha\nbeta\ngamma");
  });
});

describe("MONITORED_TOOLS", () => {
  it("covers the supported post-tool hook sources", () => {
    expect(Array.from(MONITORED_TOOLS)).toEqual(["Read", "WebFetch", "Bash", "Grep", "Glob", "Task"]);
  });
});
