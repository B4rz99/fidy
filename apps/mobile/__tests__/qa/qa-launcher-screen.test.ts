import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("QA launcher screen", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/qa/components/QaLauncherScreen.tsx"),
    "utf-8"
  );

  test("starts the requested QA profile from path params and replaces to the target route", () => {
    expect(source).toContain("parseLocalQaProfileRouteParam(rawProfile)");
    expect(source).toContain("parseQaTargetKeyRouteParam(rawTargetKey)");
    expect(source).toContain("await useAuthStore.getState().startLocalQaSession(profile);");
    expect(source).toContain("replace(target as never);");
    expect(source).toContain('error instanceof Error ? error.message : "unknown"');
  });
});
