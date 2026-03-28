/**
 * Expo config plugin that adds the FidyWidgetExtension target to the Xcode project.
 *
 * This plugin runs during `npx expo prebuild` and:
 *  1. Adds App Group entitlement to the main app
 *  2. Copies Swift sources, Info.plist, and entitlements into ios/FidyWidgetExtension/
 *  3. Creates the widget extension target in the Xcode project
 *  4. Configures build settings, frameworks, and embed phase
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  createRunOncePlugin,
  withEntitlementsPlist,
  withXcodeProject,
} = require("@expo/config-plugins");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_NAME = "FidyWidgetExtension";
const EXTENSION_BUNDLE_ID = "com.obarbozaa.Fidy.WidgetExtension";
const APP_GROUP = "group.com.obarbozaa.Fidy";
const DEVELOPMENT_TEAM = "75P4AX2J5P";
const DEPLOYMENT_TARGET = "18.0";
const SWIFT_VERSION = "5.0";

const SWIFT_FILES = [
  "QuickExpenseIntent.swift",
  "QuickExpenseControl.swift",
  "FidyWidgetBundle.swift",
  "FidyCategory.swift",
  "TransactionKind.swift",
];

const ALL_EXTENSION_FILES = [...SWIFT_FILES, "Info.plist", "widget.entitlements"];

// ---------------------------------------------------------------------------
// File copying
// ---------------------------------------------------------------------------

/** Copy widget source files from targets/widget/ into ios/FidyWidgetExtension/ */
const copyWidgetFiles = (projectRoot) => {
  const sourceDir = path.join(projectRoot, "targets", "widget");
  const destDir = path.join(projectRoot, "ios", EXTENSION_NAME);

  fs.mkdirSync(destDir, { recursive: true });

  for (const file of ALL_EXTENSION_FILES) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
  }
};

// ---------------------------------------------------------------------------
// Xcode helpers
// ---------------------------------------------------------------------------

const generateUuid = (project) => project.generateUuid();

// Xcode build setting keys use SCREAMING_SNAKE_CASE by convention.
const EXTENSION_BUILD_SETTINGS = {
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
  DEVELOPMENT_TEAM,
  GCC_C_LANGUAGE_STANDARD: "gnu17",
  GENERATE_INFOPLIST_FILE: "NO",
  INFOPLIST_FILE: `${EXTENSION_NAME}/Info.plist`,
  INFOPLIST_KEY_CFBundleDisplayName: EXTENSION_NAME,
  INFOPLIST_KEY_NSHumanReadableCopyright: '""',
  IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
  LD_RUNPATH_SEARCH_PATHS:
    '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
  MARKETING_VERSION: "1.0",
  PRODUCT_BUNDLE_IDENTIFIER: EXTENSION_BUNDLE_ID,
  PRODUCT_NAME: '"$(TARGET_NAME)"',
  SKIP_INSTALL: "YES",
  SWIFT_EMIT_LOC_STRINGS: "YES",
  SWIFT_VERSION,
  TARGETED_DEVICE_FAMILY: '"1,2"',
};

/** Reconcile build settings on the extension's Debug/Release configurations. */
const reconcileBuildSettings = (project) => {
  const configurations = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configurations)) {
    const config = configurations[key];
    if (
      typeof config === "object" &&
      config.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER === EXTENSION_BUNDLE_ID
    ) {
      config.buildSettings = {
        ...config.buildSettings,
        ...EXTENSION_BUILD_SETTINGS,
      };
    }
  }
};

const addWidgetExtensionTarget = (project) => {
  // 0. Check if the target already exists
  const existingTargets = project.pbxNativeTargetSection();
  const targetExists = Object.values(existingTargets).some(
    (t) => typeof t === "object" && t !== null && t.name === EXTENSION_NAME
  );

  // 1. Create structural elements only if the target doesn't exist
  if (!targetExists) {
    const target = project.addTarget(
      EXTENSION_NAME,
      "app_extension",
      EXTENSION_NAME,
      EXTENSION_BUNDLE_ID
    );

    const sourcesBuildPhaseUuid = generateUuid(project);
    project.addBuildPhase(
      SWIFT_FILES.map((f) => `${EXTENSION_NAME}/${f}`),
      "PBXSourcesBuildPhase",
      "Sources",
      target.uuid,
      undefined,
      sourcesBuildPhaseUuid
    );

    const groupUuid = generateUuid(project);
    const extensionGroup = project.addPbxGroup(
      ALL_EXTENSION_FILES,
      EXTENSION_NAME,
      EXTENSION_NAME,
      '"<group>"',
      { uuid: groupUuid }
    );
    const mainGroupId = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup(extensionGroup.uuid, mainGroupId);

    const frameworksBuildPhaseUuid = generateUuid(project);
    project.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      target.uuid,
      undefined,
      frameworksBuildPhaseUuid
    );

    project.addFramework("WidgetKit.framework", {
      target: target.uuid,
      link: true,
    });
    project.addFramework("SwiftUI.framework", {
      target: target.uuid,
      link: true,
    });

    const mainTarget = project.getFirstTarget();
    const embedPhaseUuid = generateUuid(project);
    project.addBuildPhase(
      [`${EXTENSION_NAME}.appex`],
      "PBXCopyFilesBuildPhase",
      "Embed App Extensions",
      mainTarget.firstTarget.uuid,
      "app_extension",
      embedPhaseUuid
    );
  }

  // 2. Always reconcile build settings
  reconcileBuildSettings(project);
};

// ---------------------------------------------------------------------------
// Plugin composition
// ---------------------------------------------------------------------------

const withAppGroupEntitlement = (config) =>
  withEntitlementsPlist(config, (modConfig) => {
    const entitlements = modConfig.modResults;
    const existingGroups = entitlements["com.apple.security.application-groups"] ?? [];

    if (!existingGroups.includes(APP_GROUP)) {
      entitlements["com.apple.security.application-groups"] = [...existingGroups, APP_GROUP];
    }

    return modConfig;
  });

const withWidgetExtensionTarget = (config) =>
  withXcodeProject(config, (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const project = modConfig.modResults;

    copyWidgetFiles(projectRoot);
    addWidgetExtensionTarget(project);

    return modConfig;
  });

const withFidyWidget = (config) => {
  const configWithEntitlements = withAppGroupEntitlement(config);
  const configWithExtension = withWidgetExtensionTarget(configWithEntitlements);
  return configWithExtension;
};

module.exports = createRunOncePlugin(withFidyWidget, "withFidyWidget", "1.0.0");
