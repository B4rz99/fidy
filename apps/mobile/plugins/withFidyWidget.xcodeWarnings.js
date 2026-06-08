const { withInfoPlist, withXcodeProject } = require("expo/config-plugins");

const ALWAYS_OUT_OF_DATE_SCRIPT_NAMES = new Set([
  '"Upload Debug Symbols to Sentry"',
  '"[Expo Dev Launcher] Strip Local Network Keys for Release"',
]);

const removeDeprecatedFullScreenKey = (config) =>
  withInfoPlist(config, (modConfig) => {
    delete modConfig.modResults.UIRequiresFullScreen;
    return modConfig;
  });

const markKnownScriptsAlwaysOutOfDate = (project) => {
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
  for (const phase of Object.values(phases)) {
    if (phase && ALWAYS_OUT_OF_DATE_SCRIPT_NAMES.has(phase.name)) {
      phase.alwaysOutOfDate = 1;
    }
  }
};

const isCppLinkerFlag = (flag) => flag.replace(/^"|"$/g, "") === "-lc++";

const removeDuplicateCppLinkerFlag = (project) => {
  const configurations = project.hash.project.objects.XCBuildConfiguration ?? {};
  for (const config of Object.values(configurations)) {
    const flags = config?.buildSettings?.OTHER_LDFLAGS;
    if (Array.isArray(flags)) {
      let hasCppLinkerFlag = false;
      config.buildSettings.OTHER_LDFLAGS = flags.filter((flag) => {
        if (!isCppLinkerFlag(flag)) {
          return true;
        }

        if (hasCppLinkerFlag) {
          return false;
        }

        hasCppLinkerFlag = true;
        return true;
      });
    }
  }
};

const withAppTargetWarningCleanup = (config) =>
  withXcodeProject(config, (modConfig) => {
    markKnownScriptsAlwaysOutOfDate(modConfig.modResults);
    removeDuplicateCppLinkerFlag(modConfig.modResults);
    return modConfig;
  });

const withXcodeWarningCleanup = (config) =>
  withAppTargetWarningCleanup(removeDeprecatedFullScreenKey(config));

module.exports = { withXcodeWarningCleanup };
