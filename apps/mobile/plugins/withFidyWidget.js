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
} = require("expo/config-plugins");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENSION_NAME = "FidyWidgetExtension";
const EXTENSION_BUNDLE_ID = "com.obarbozaa.Fidy.WidgetExtension";
const APP_GROUP = "group.com.obarbozaa.Fidy";
const DEVELOPMENT_TEAM = "75P4AX2J5P";
const DEPLOYMENT_TARGET = "18.0";
const SWIFT_VERSION = "6.0";

const SWIFT_FILES = [
  "QuickExpenseIntent.swift",
  "QuickExpenseControl.swift",
  "OpenAddTransactionIntent.swift",
  "ExpenseSnippetIntent.swift",
  "SaveExpenseIntent.swift",
  "FidyWidgetBundle.swift",
  "FidyCategory.swift",
  "TransactionKind.swift",
];

const ALL_EXTENSION_FILES = [...SWIFT_FILES, "widget.entitlements"];

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

  // Copy Info.plist with the name addTarget() expects
  fs.copyFileSync(
    path.join(sourceDir, "Info.plist"),
    path.join(destDir, `${EXTENSION_NAME}-Info.plist`)
  );
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
  // Find the extension target's buildConfigurationList UUID
  const nativeTargets = project.pbxNativeTargetSection();
  let configListId = null;
  for (const val of Object.values(nativeTargets)) {
    if (typeof val === "object" && val !== null && val.name === EXTENSION_NAME) {
      configListId = val.buildConfigurationList;
      break;
    }
  }
  if (!configListId) return;

  // Get the configuration UUIDs from the XCConfigurationList via direct hash access
  const configLists = project.hash.project.objects.XCConfigurationList;
  const configList = configLists?.[configListId];
  if (!configList?.buildConfigurations) return;

  const configUuids = new Set(configList.buildConfigurations.map((c) => c.value));

  // Apply build settings to those specific configurations
  const buildConfigs = project.hash.project.objects.XCBuildConfiguration;
  for (const uuid of configUuids) {
    const config = buildConfigs?.[uuid];
    if (typeof config === "object" && config.buildSettings) {
      Object.assign(config.buildSettings, EXTENSION_BUILD_SETTINGS);
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

    // Apply build settings immediately after target creation — the xcode
    // package creates Debug/Release configs but leaves them sparse.
    const nativeTarget = project.pbxNativeTargetSection()[target.uuid];
    const configListId = nativeTarget?.buildConfigurationList;
    if (configListId) {
      const configList = project.hash.project.objects.XCConfigurationList?.[configListId];
      if (configList?.buildConfigurations) {
        const buildConfigs = project.hash.project.objects.XCBuildConfiguration;
        for (const ref of configList.buildConfigurations) {
          const config = buildConfigs?.[ref.value];
          if (typeof config === "object" && config.buildSettings) {
            Object.assign(config.buildSettings, EXTENSION_BUILD_SETTINGS);
          }
        }
      }
    }

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

    // Embed the extension in the main app — create the phase with an empty
    // file list, then manually wire the target's product reference into the
    // phase so CocoaPods doesn't encounter an orphaned PBXFileReference.
    const mainTarget = project.getFirstTarget();
    const embedPhaseUuid = generateUuid(project);
    project.addBuildPhase(
      [],
      "PBXCopyFilesBuildPhase",
      "Embed App Extensions",
      mainTarget.firstTarget.uuid,
      "app_extension",
      embedPhaseUuid
    );

    // Find the target's product reference (the .appex created by addTarget)
    const nativeTargetEntry = project.pbxNativeTargetSection()[target.uuid];
    const productRefUuid = nativeTargetEntry?.productReference;

    if (productRefUuid) {
      // Add product to the Products group so CocoaPods can resolve its parent
      const productsGroupKey = Object.keys(project.hash.project.objects.PBXGroup || {}).find(
        (key) => {
          const group = project.hash.project.objects.PBXGroup[key];
          return typeof group === "object" && group.name === "Products";
        }
      );
      if (productsGroupKey) {
        const productsGroup = project.hash.project.objects.PBXGroup[productsGroupKey];
        const alreadyInGroup = productsGroup.children?.some((c) => c.value === productRefUuid);
        if (!alreadyInGroup) {
          productsGroup.children.push({
            value: productRefUuid,
            comment: `${EXTENSION_NAME}.appex`,
          });
        }
      }

      // Add a PBXBuildFile referencing the product in the embed phase
      const buildFileUuid = generateUuid(project);
      project.hash.project.objects.PBXBuildFile[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: productRefUuid,
        settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
      };
      project.hash.project.objects.PBXBuildFile[`${buildFileUuid}_comment`] =
        `${EXTENSION_NAME}.appex in Embed App Extensions`;

      // Add the build file to the embed phase's files array
      const copyFilesPhases = project.hash.project.objects.PBXCopyFilesBuildPhase || {};
      const embedPhase = copyFilesPhases[embedPhaseUuid];
      if (embedPhase) {
        embedPhase.files.push({
          value: buildFileUuid,
          comment: `${EXTENSION_NAME}.appex in Embed App Extensions`,
        });
      }
    }
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
