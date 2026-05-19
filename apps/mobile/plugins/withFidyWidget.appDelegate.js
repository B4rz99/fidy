const { withDangerousMod } = require("expo/config-plugins");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const legacyWindowCreation =
  "    window = UIWindow(frame: UIScreen.main.bounds)\n" + "    factory.startReactNative(\n";
const sceneAwareWindowCreation =
  "    window = makeRootWindow(for: application)\n" + "    factory.startReactNative(\n";
const legacyOpenUrlSignature = "  public override func application(\n    _ app: UIApplication,";
const annotatedOpenUrlSignature =
  "  @available(iOS, introduced: 9.0, deprecated: 26.0)\n  public override func application(\n    _ app: UIApplication,";
const reactNativeDelegateMarker = "\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate {";
const rootWindowHelpers =
  "\n#if os(iOS) || os(tvOS)\n" +
  "private func makeRootWindow(for application: UIApplication) -> UIWindow {\n" +
  "  if let windowScene = application.connectedScenes.compactMap({ $0 as? UIWindowScene }).first {\n" +
  "    return UIWindow(windowScene: windowScene)\n" +
  "  }\n" +
  "\n" +
  "  return makeLegacyRootWindow()\n" +
  "}\n" +
  "\n" +
  "@available(iOS, deprecated: 26.0)\n" +
  "@available(tvOS, deprecated: 26.0)\n" +
  "private func makeLegacyRootWindow() -> UIWindow {\n" +
  "  UIWindow(frame: UIScreen.main.bounds)\n" +
  "}\n" +
  "#endif\n";

const getAppDelegatePath = (modConfig) =>
  path.join(
    modConfig.modRequest.platformProjectRoot,
    modConfig.modRequest.projectName,
    "AppDelegate.swift"
  );

const patchAppDelegateSource = (source) => {
  const windowPatched = source.replace(legacyWindowCreation, sceneAwareWindowCreation);
  const openUrlPatched = windowPatched.includes(annotatedOpenUrlSignature)
    ? windowPatched
    : windowPatched.replace(legacyOpenUrlSignature, annotatedOpenUrlSignature);
  return openUrlPatched.includes("private func makeRootWindow(")
    ? openUrlPatched
    : openUrlPatched.replace(reactNativeDelegateMarker, `${rootWindowHelpers}${reactNativeDelegateMarker}`);
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
