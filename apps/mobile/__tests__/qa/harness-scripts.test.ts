import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("mobile QA harness scripts", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(__dirname, "../../../../package.json"), "utf-8")
  ) as {
    scripts?: Record<string, string>;
  };
  const scriptSource = readFileSync(
    resolve(__dirname, "../../../../scripts/mobile-qa.ts"),
    "utf-8"
  );

  test("registers the canonical qa commands at the repo root", () => {
    expect(packageJson.scripts).toMatchObject({
      "qa:ios": expect.any(String),
      "qa:reset": expect.any(String),
      "qa:seed": expect.any(String),
      "qa:open": expect.any(String),
      "qa:smoke": expect.any(String),
    });
  });

  test("drives the simulator through xcodebuildmcp and stores artifacts in .context", () => {
    expect(scriptSource).toContain("xcodebuildmcp");
    expect(scriptSource).toContain(".context/mobile-qa");
    expect(scriptSource).toContain("transfer-conflict");
    expect(scriptSource).toContain("qa-open");
    expect(scriptSource).toContain("targetKey");
  });
});
