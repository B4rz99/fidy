import { describe, expect, it } from "bun:test";

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
