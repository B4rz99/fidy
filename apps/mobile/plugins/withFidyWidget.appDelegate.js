const { withDangerousMod } = require("expo/config-plugins");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const legacyWindowCreationPattern =
  /^(\s*)window\s*=\s*UIWindow\(frame:\s*UIScreen\.main\.bounds\)(\s*\n\s*factory\.startReactNative\()/m;
const annotatedOpenUrlSignature =
  "  @available(iOS, introduced: 9.0, deprecated: 26.0)\n  public override func application(\n    _ app: UIApplication,";
const openUrlSignaturePattern =
  /^(\s*)public\s+override\s+func\s+application\(\s*\n\s*_ app:\s*UIApplication,/m;
const reactNativeDelegatePattern =
  /^class\s+ReactNativeDelegate:\s+ExpoReactNativeFactoryDelegate\s*\{/m;
const reactNativeDelegateDeclaration =
  "class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {";
const legacyRootWindowHelperPattern =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\nprivate func makeRootWindow\(for application: UIApplication\) -> UIWindow \{\n  if let windowScene = application\.connectedScenes\.compactMap\(\{ \$0 as\? UIWindowScene \}\)\.first \{\n    return UIWindow\(windowScene: windowScene\)\n  \}\n\n  return makeLegacyRootWindow\(\)\n\}\n\n@available\(iOS, deprecated: 26\.0\)\n@available\(tvOS, deprecated: 26\.0\)\nprivate func makeLegacyRootWindow\(\) -> UIWindow \{\n  UIWindow\(frame: UIScreen\.main\.bounds\)\n\}\n#endif\n/;
const rootWindowHelperBlockPattern =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\nprivate func makeRootWindow\(for application: UIApplication\) -> UIWindow \{[\s\S]*?\n\}\n#endif\n/;
const rootWindowHelpers =
  "\n#if os(iOS) || os(tvOS)\n" +
  "private func makeRootWindow(for application: UIApplication) -> UIWindow {\n" +
  "  if let windowScene = application.connectedScenes.compactMap({ $0 as? UIWindowScene }).first {\n" +
  "    return UIWindow(windowScene: windowScene)\n" +
  "  }\n" +
  "\n" +
  "  return makeSceneLessFallbackRootWindow()\n" +
  "}\n" +
  "\n" +
  "private func makeSceneLessFallbackRootWindow() -> UIWindow {\n" +
  "  UIWindow(frame: UIScreen.main.bounds)\n" +
  "}\n" +
  "#endif\n";

const replaceRequired = (source, pattern, replacement, label) => {
  const patched = source.replace(pattern, replacement);
  if (patched === source) {
    throw new Error(`Unable to patch generated AppDelegate.swift ${label}`);
  }
  return patched;
};

const patchRootWindowCreation = (source) =>
  source.includes("window = makeRootWindow(for:")
    ? source
    : replaceRequired(
        source,
        legacyWindowCreationPattern,
        "$1window = makeRootWindow(for: application)$2",
        "root window creation"
      );

const patchOpenUrlAvailability = (source) =>
  source.includes(annotatedOpenUrlSignature)
    ? source
    : replaceRequired(
        source,
        openUrlSignaturePattern,
        annotatedOpenUrlSignature,
        "open URL availability annotation"
      );

const patchLegacyRootWindowHelper = (source) =>
  source.replace(legacyRootWindowHelperPattern, rootWindowHelpers);

const patchRootWindowHelperBlock = (source) =>
  source.replace(rootWindowHelperBlockPattern, rootWindowHelpers);

const insertRootWindowHelpers = (source) =>
  source.includes("private func makeRootWindow(")
    ? source
    : replaceRequired(
        source,
        reactNativeDelegatePattern,
        `${rootWindowHelpers}${reactNativeDelegateDeclaration}`,
        "root window helpers"
      );

const getAppDelegatePath = (modConfig) =>
  path.join(
    modConfig.modRequest.platformProjectRoot,
    modConfig.modRequest.projectName,
    "AppDelegate.swift"
  );

const patchAppDelegateSource = (source) => {
  const windowPatched = patchRootWindowCreation(source);
  const openUrlPatched = patchOpenUrlAvailability(windowPatched);
  const legacyHelperPatched = patchLegacyRootWindowHelper(openUrlPatched);
  const helperBlockPatched = patchRootWindowHelperBlock(legacyHelperPatched);
  return insertRootWindowHelpers(helperBlockPatched);
};

const markAppDelegateIos26Compatibility = (config) =>
  withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const appDelegatePath = getAppDelegatePath(modConfig);
      const source = readFileSync(appDelegatePath, "utf8");
      const patched = patchAppDelegateSource(source);

      if (patched !== source) {
        writeFileSync(appDelegatePath, patched);
      }

      return modConfig;
    },
  ]);

module.exports = { markAppDelegateIos26Compatibility };
