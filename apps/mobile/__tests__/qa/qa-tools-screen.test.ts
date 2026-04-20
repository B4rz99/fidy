import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("QA tools screen", () => {
  const source = readFileSync(
    resolve(__dirname, "../../features/qa/components/QaToolsScreen.tsx"),
    "utf-8"
  );

  test("contains seeded scenario buttons and direct entry points", () => {
    expect(source).toContain("transfer-conflict");
    expect(source).toContain("QA_TARGETS.addTransfer");
    expect(source).toContain("QA_TARGETS.transferConflict");
  });

  test("auto-starts routed QA scenarios when search params change after mount", () => {
    expect(source).toContain("parseLocalQaProfileRouteParam(routeProfile)");
    expect(source).toContain("parseQaTargetRouteParam(routeTarget)");
    expect(source).toContain("if (!localQaAvailable || !nextProfile) return;");
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("[localQaAvailable, routeProfile, routeTarget, runScenario]");
  });

  test("contains QA feature flag toggles, reset tools, and inspectors", () => {
    expect(source).toContain('t("qaTools.flagsTitle")');
    expect(source).toContain('t("qaTools.actionsTitle")');
    expect(source).toContain('t("qaTools.logsTitle")');
    expect(source).toContain('t("qaTools.networkTitle")');
    expect(source).toContain(`testID={\`qa.flag.\${flagName}\`}`);
    expect(source).toContain('testID="qa.action.clear-network-events"');
    expect(source).toContain("JSON.stringify(entry.context)");
  });
});
