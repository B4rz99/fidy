import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("Profile screen local QA controls", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/settings/components/ProfileScreen.tsx"),
    "utf-8"
  );
  const qaToolsSource = readFileSync(
    resolve(__dirname, "../../features/qa/components/LocalQaProfileTools.tsx"),
    "utf-8"
  );

  test("renders local QA scenario actions when auth mode is local QA", () => {
    expect(source).toContain("LocalQaProfileTools");
    expect(qaToolsSource).toContain('authMode !== "local-qa"');
    expect(qaToolsSource).toContain('t("settings.localQaReset")');
    expect(qaToolsSource).toContain('t("settings.localQaOpenTools")');
    expect(qaToolsSource).toContain('router.push("/qa-tools")');
  });
});
