import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Plugin helper is CommonJS.
const {
  buildWidgetConfigContent,
  copyWidgetFiles,
  extensionName: EXTENSION_NAME,
  getAppGroup,
  getExtensionBundleId,
} = require("../../plugins/withFidyWidget.files.js");

const tempDirs: string[] = [];

const createTempProjectRoot = () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "with-fidy-widget-"));
  tempDirs.push(projectRoot);

  const sourceDir = path.join(projectRoot, "targets", "widget");
  for (const file of [
    "QuickExpenseIntent.swift",
    "FidyCategory.swift",
    "TransactionKind.swift",
    "FidyWidgetBundle.swift",
    "widget.entitlements",
    "Info.plist",
  ]) {
    const filePath = path.join(sourceDir, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `contents:${file}`);
  }

  return projectRoot;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("withFidyWidget.files", () => {
  it("derives widget identifiers from config", () => {
    expect(getAppGroup({ ios: { bundleIdentifier: "com.fidy.app" } })).toBe("group.com.fidy.app");
    expect(getExtensionBundleId({ ios: { bundleIdentifier: "com.fidy.app" } })).toBe(
      "com.fidy.app.WidgetExtension"
    );
    expect(getAppGroup({})).toBe("group.com.obarbozaa.Fidy");
  });

  it("builds widget config source with the app group", () => {
    expect(buildWidgetConfigContent("group.com.fidy.app")).toContain(
      'let APP_GROUP_SUITE_NAME = "group.com.fidy.app"'
    );
  });

  it("copies widget files and generates WidgetConfig.swift", () => {
    const projectRoot = createTempProjectRoot();

    copyWidgetFiles(projectRoot, { ios: { bundleIdentifier: "com.fidy.app" } });

    const destDir = path.join(projectRoot, "ios", EXTENSION_NAME);
    expect(readFileSync(path.join(destDir, "QuickExpenseIntent.swift"), "utf8")).toBe(
      "contents:QuickExpenseIntent.swift"
    );
    expect(readFileSync(path.join(destDir, "widget.entitlements"), "utf8")).toBe(
      "contents:widget.entitlements"
    );
    expect(readFileSync(path.join(destDir, "WidgetConfig.swift"), "utf8")).toContain(
      'let APP_GROUP_SUITE_NAME = "group.com.fidy.app"'
    );
    expect(readFileSync(path.join(destDir, `${EXTENSION_NAME}-Info.plist`), "utf8")).toBe(
      "contents:Info.plist"
    );
  });
});

describe("withFidyWidget warning cleanup", () => {
  it("keeps AppDelegate root window fallback non-crashing", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../plugins/withFidyWidget.appDelegate.js"),
      "utf8"
    );

    expect(source).toContain("makeSceneLessFallbackRootWindow");
    expect(source).toContain("UIWindow(frame: UIScreen.main.bounds)");
    expect(source).not.toContain("(UIWindow.self as NSObject.Type).init() as! UIWindow");
    expect(source).not.toContain("fatalError");
  });

  it("deduplicates the C++ linker flag instead of removing every copy", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../plugins/withFidyWidget.xcodeWarnings.js"),
      "utf8"
    );

    expect(source).toContain('flag.replace(/^"|"$/g, "") === "-lc++"');
    expect(source).toContain("hasCppLinkerFlag = true");
    expect(source).not.toContain("flag !== '\"-lc++\"'");
  });

  it("stores always-out-of-date script flags as Xcode string values", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../../plugins/withFidyWidget.xcodeWarnings.js"),
      "utf8"
    );

    expect(source).toContain('phase.alwaysOutOfDate = "1"');
    expect(source).not.toContain("phase.alwaysOutOfDate = 1");
  });
});
