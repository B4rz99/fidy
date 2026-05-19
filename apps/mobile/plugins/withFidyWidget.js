/**
 * Expo config plugin that adds the FidyWidgetExtension target to the Xcode project.
 *
 * This plugin runs during `npx expo prebuild` and:
 *  1. Adds App Group entitlement to the main app
 *  2. Copies Swift sources, Info.plist, and entitlements into ios/FidyWidgetExtension/
 *  3. Creates the widget extension target in the Xcode project
 *  4. Configures build settings, frameworks, and embed phase
 */

const {
  createRunOncePlugin,
  withEntitlementsPlist,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const {
  reconcileAppDeploymentTarget,
  withIosDeploymentTarget,
  withPodsDeploymentTarget,
} = require("./withFidyWidget.deploymentTarget");
const {
  copyWidgetFiles,
  deploymentTarget: DEPLOYMENT_TARGET,
  extensionName: EXTENSION_NAME,
  getAppGroup,
  getDevelopmentTeam,
  getExtensionBundleId,
  staticExtensionFiles: STATIC_EXTENSION_FILES,
  swiftFiles: SWIFT_FILES,
  swiftVersion: SWIFT_VERSION,
} = require("./withFidyWidget.files");

const generateUuid = (project) => project.generateUuid();

const BASE_EXTENSION_BUILD_SETTINGS = {
  ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: '""',
  ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: '""',
  CLANG_ANALYZER_NONNULL: "YES",
  CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: "YES_AGGRESSIVE",
  CLANG_CXX_LANGUAGE_STANDARD: '"gnu++20"',
  CLANG_ENABLE_OBJC_WEAK: "YES",
  CLANG_WARN_DOCUMENTATION_COMMENTS: "YES",
  CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: "YES",
  CLANG_WARN_UNGUARDED_AVAILABILITY: "YES_AGGRESSIVE",
  CODE_SIGN_ENTITLEMENTS: `${EXTENSION_NAME}/widget.entitlements`,
  CODE_SIGN_STYLE: "Automatic",
  CURRENT_PROJECT_VERSION: "1",
  DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
  GCC_C_LANGUAGE_STANDARD: "gnu17",
  INFOPLIST_KEY_CFBundleDisplayName: EXTENSION_NAME,
  INFOPLIST_KEY_NSHumanReadableCopyright: '""',
  IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
  LD_RUNPATH_SEARCH_PATHS:
    '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
  MARKETING_VERSION: "1.0",
  PRODUCT_NAME: '"$(TARGET_NAME)"',
  SKIP_INSTALL: "YES",
  SWIFT_EMIT_LOC_STRINGS: "YES",
  SWIFT_VERSION,
  TARGETED_DEVICE_FAMILY: '"1,2"',
};

const isObject = (value) => typeof value === "object" && value !== null;
const isNamedExtensionTarget = (target) => isObject(target) && target.name === EXTENSION_NAME;
const getProductsGroupComment = () => `${EXTENSION_NAME}.appex`;
const getEmbedPhaseComment = () => `${EXTENSION_NAME}.appex in Embed App Extensions`;
const getXcodeObjects = (project) => project.hash.project.objects;

// Xcode build setting keys use SCREAMING_SNAKE_CASE by convention.
const buildSettings = (config) => {
  const developmentTeam = getDevelopmentTeam(config);
  const settings = {
    ...BASE_EXTENSION_BUILD_SETTINGS,
    PRODUCT_BUNDLE_IDENTIFIER: getExtensionBundleId(config),
  };
  return developmentTeam ? { ...settings, DEVELOPMENT_TEAM: developmentTeam } : settings;
};

/** Reconcile build settings on the extension's Debug/Release configurations. */
const getExtensionConfigListId = (project) =>
  Object.values(project.pbxNativeTargetSection()).find(isNamedExtensionTarget)
    ?.buildConfigurationList ?? null;

const getConfigList = (project, configListId) =>
  getXcodeObjects(project).XCConfigurationList?.[configListId] ?? null;

const getBuildConfigurationRefs = (project, configListId) =>
  getConfigList(project, configListId)?.buildConfigurations ?? [];

const applySettingsToBuildConfig = (config, settings) => {
  if (isObject(config) && config.buildSettings) {
    config.buildSettings = { ...config.buildSettings, ...settings };
  }
};

const applySettingsToConfigRefs = (project, configRefs, settings) => {
  const buildConfigs = getXcodeObjects(project).XCBuildConfiguration;
  for (const ref of configRefs) {
    applySettingsToBuildConfig(buildConfigs?.[ref.value], settings);
  }
};

const reconcileBuildSettings = (project, settings) => {
  const configListId = getExtensionConfigListId(project);
  if (!configListId) return;
  applySettingsToConfigRefs(project, getBuildConfigurationRefs(project, configListId), settings);
};

const targetExists = (project) =>
  Object.values(project.pbxNativeTargetSection()).some(isNamedExtensionTarget);

const createWidgetTarget = (project, extensionBundleId) =>
  project.addTarget(EXTENSION_NAME, "app_extension", EXTENSION_NAME, extensionBundleId);

const applySettingsToTarget = (project, targetUuid, settings) => {
  const nativeTarget = project.pbxNativeTargetSection()[targetUuid];
  const configListId = nativeTarget?.buildConfigurationList;
  if (!configListId) return;
  applySettingsToConfigRefs(project, getBuildConfigurationRefs(project, configListId), settings);
};

const addWidgetSourcesBuildPhase = (project, targetUuid) =>
  project.addBuildPhase(
    SWIFT_FILES.map((file) => `${EXTENSION_NAME}/${file}`),
    "PBXSourcesBuildPhase",
    "Sources",
    targetUuid,
    undefined,
    generateUuid(project)
  );

const addWidgetExtensionGroup = (project) => {
  const extensionGroup = project.addPbxGroup(
    [...STATIC_EXTENSION_FILES, "WidgetConfig.swift"],
    EXTENSION_NAME,
    EXTENSION_NAME,
    '"<group>"',
    { uuid: generateUuid(project) }
  );
  const mainGroupId = project.getFirstProject().firstProject.mainGroup;
  project.addToPbxGroup(extensionGroup.uuid, mainGroupId);
};

const addFrameworkBuildPhase = (project, targetUuid) =>
  project.addBuildPhase(
    [],
    "PBXFrameworksBuildPhase",
    "Frameworks",
    targetUuid,
    undefined,
    generateUuid(project)
  );

const addWidgetFrameworks = (project, targetUuid) => {
  addFrameworkBuildPhase(project, targetUuid);
  project.addFramework("WidgetKit.framework", { target: targetUuid, link: true });
  project.addFramework("SwiftUI.framework", { target: targetUuid, link: true });
};

const createEmbedPhase = (project) => {
  const embedPhaseUuid = generateUuid(project);
  const mainTarget = project.getFirstTarget();
  project.addBuildPhase(
    [],
    "PBXCopyFilesBuildPhase",
    "Embed App Extensions",
    mainTarget.firstTarget.uuid,
    "app_extension",
    embedPhaseUuid
  );
  return embedPhaseUuid;
};

const getProductReferenceUuid = (project, targetUuid) =>
  project.pbxNativeTargetSection()[targetUuid]?.productReference ?? null;

const getProductsGroup = (project) => {
  const groups = getXcodeObjects(project).PBXGroup || {};
  return (
    Object.values(groups).find((group) => isObject(group) && group.name === "Products") ?? null
  );
};

const addProductToProductsGroup = (project, productRefUuid) => {
  const productsGroup = getProductsGroup(project);
  if (!productsGroup) return;
  const alreadyInGroup = productsGroup.children?.some((child) => child.value === productRefUuid);
  if (alreadyInGroup) return;
  productsGroup.children.push({
    value: productRefUuid,
    comment: getProductsGroupComment(),
  });
};

const createEmbedBuildFile = (project, productRefUuid) => {
  const buildFileUuid = generateUuid(project);
  getXcodeObjects(project).PBXBuildFile[buildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: productRefUuid,
    settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
  };
  getXcodeObjects(project).PBXBuildFile[`${buildFileUuid}_comment`] = getEmbedPhaseComment();
  return buildFileUuid;
};

const addBuildFileToEmbedPhase = (project, embedPhaseUuid, buildFileUuid) => {
  const embedPhase = getXcodeObjects(project).PBXCopyFilesBuildPhase?.[embedPhaseUuid];
  if (!embedPhase) return;
  embedPhase.files.push({
    value: buildFileUuid,
    comment: getEmbedPhaseComment(),
  });
};

const embedWidgetExtension = (project, targetUuid) => {
  const productRefUuid = getProductReferenceUuid(project, targetUuid);
  if (!productRefUuid) return;
  const embedPhaseUuid = createEmbedPhase(project);
  addProductToProductsGroup(project, productRefUuid);
  addBuildFileToEmbedPhase(project, embedPhaseUuid, createEmbedBuildFile(project, productRefUuid));
};

const createWidgetExtensionStructure = (project, extensionBundleId, settings) => {
  const target = createWidgetTarget(project, extensionBundleId);
  applySettingsToTarget(project, target.uuid, settings);
  addWidgetSourcesBuildPhase(project, target.uuid);
  addWidgetExtensionGroup(project);
  addWidgetFrameworks(project, target.uuid);
  embedWidgetExtension(project, target.uuid);
};

const addWidgetExtensionTarget = (project, config) => {
  const extensionBundleId = getExtensionBundleId(config);
  const settings = buildSettings(config);
  if (!targetExists(project)) {
    createWidgetExtensionStructure(project, extensionBundleId, settings);
  }
  reconcileBuildSettings(project, settings);
};

const markAppDelegateIos26Compatibility = (config) =>
  withDangerousMod(config, [
    "ios",
    (modConfig) => {
      const appDelegatePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        modConfig.modRequest.projectName,
        "AppDelegate.swift"
      );
      const source = readFileSync(appDelegatePath, "utf8");
      const legacyWindowCreation =
        "    window = UIWindow(frame: UIScreen.main.bounds)\n" +
        "    factory.startReactNative(\n";
      const sceneAwareWindowCreation =
        "    window = makeRootWindow(for: application)\n" +
        "    factory.startReactNative(\n";
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

      const windowPatched = source.replace(legacyWindowCreation, sceneAwareWindowCreation);
      const openUrlPatched = windowPatched.includes(annotatedOpenUrlSignature)
        ? windowPatched
        : windowPatched.replace(legacyOpenUrlSignature, annotatedOpenUrlSignature);
      const helpersPatched = openUrlPatched.includes("private func makeRootWindow(")
        ? openUrlPatched
        : openUrlPatched.replace(reactNativeDelegateMarker, `${rootWindowHelpers}${reactNativeDelegateMarker}`);

      if (helpersPatched !== source) {
        writeFileSync(appDelegatePath, helpersPatched);
      }

      return modConfig;
    },
  ]);

// ---------------------------------------------------------------------------
// Plugin composition
// ---------------------------------------------------------------------------

const withAppGroupEntitlement = (config) => {
  const appGroup = getAppGroup(config);

  return withEntitlementsPlist(config, (modConfig) => {
    const entitlements = modConfig.modResults;
    const existingGroups = entitlements["com.apple.security.application-groups"] ?? [];

    if (!existingGroups.includes(appGroup)) {
      entitlements["com.apple.security.application-groups"] = [...existingGroups, appGroup];
    }

    return modConfig;
  });
};

const withAppGroupInfoPlistKey = (config) => {
  const appGroup = getAppGroup(config);

  return withInfoPlist(config, (modConfig) => {
    modConfig.modResults.FidyAppGroupSuiteName = appGroup;
    return modConfig;
  });
};

const withWidgetExtensionTarget = (config) =>
  withXcodeProject(config, (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const project = modConfig.modResults;

    copyWidgetFiles(projectRoot, config);
    reconcileAppDeploymentTarget(project, DEPLOYMENT_TARGET);
    addWidgetExtensionTarget(project, config);

    return modConfig;
  });

const withFidyWidget = (config) => {
  const configWithEntitlements = withAppGroupEntitlement(config);
  const configWithInfoPlist = withAppGroupInfoPlistKey(configWithEntitlements);
  const configWithDeploymentTarget = withIosDeploymentTarget(
    configWithInfoPlist,
    DEPLOYMENT_TARGET
  );
  const configWithPodsDeploymentTarget = withPodsDeploymentTarget(
    configWithDeploymentTarget,
    DEPLOYMENT_TARGET
  );
  const configWithExtension = withWidgetExtensionTarget(configWithPodsDeploymentTarget);
  const configWithAppDelegateCompatibility =
    markAppDelegateIos26Compatibility(configWithExtension);
  return configWithAppDelegateCompatibility;
};

module.exports = createRunOncePlugin(withFidyWidget, "withFidyWidget", "1.0.0");
