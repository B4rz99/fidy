const { withPodfile, withPodfileProperties } = require("expo/config-plugins");

const PODS_DEPLOYMENT_TARGET_PATCH_START = "# @generated begin fidy pods deployment target";
const PODS_DEPLOYMENT_TARGET_PATCH_END = "# @generated end fidy pods deployment target";
const PODS_DEPLOYMENT_TARGET_PATCH_REGEX = new RegExp(
  `${PODS_DEPLOYMENT_TARGET_PATCH_START}[\\s\\S]*?${PODS_DEPLOYMENT_TARGET_PATCH_END}`
);
const LEGACY_PODS_DEPLOYMENT_TARGET_PATCH_REGEX =
  /\n\s+installer\.pods_project\.targets\.each do \|target\|\n\s+target\.build_configurations\.each do \|config\|\n\s+deployment_target = config\.build_settings\['IPHONEOS_DEPLOYMENT_TARGET'\]\n\s+if deployment_target\.nil\? \|\| Gem::Version\.new\(deployment_target\) < Gem::Version\.new\('[^']+'\)\n\s+config\.build_settings\['IPHONEOS_DEPLOYMENT_TARGET'\] = '[^']+'\n\s+end\n\s+end\n\s+end\n/;

const buildPodsDeploymentTargetPatch = (deploymentTarget) => `
    ${PODS_DEPLOYMENT_TARGET_PATCH_START}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target.nil? || Gem::Version.new(deployment_target) < Gem::Version.new('${deploymentTarget}')
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
        end
      end

      if target.name == 'EXUpdates'
        target.shell_script_build_phases.each do |phase|
          if phase.name == '[CP-User] Generate updates resources for expo-updates'
            phase.always_out_of_date = '1'
          end
        end
      end

      if target.name == 'hermes-engine'
        target.shell_script_build_phases.each do |phase|
          if phase.name == '[CP-User] [Hermes] Replace Hermes for the right configuration, if needed'
            phase.always_out_of_date = '1'
          end
        end
      end
    end
    ${PODS_DEPLOYMENT_TARGET_PATCH_END}
`;

const getBuildConfigurations = (project) => project.hash.project.objects.XCBuildConfiguration ?? {};

const parseVersion = (version) => version.split(".").map((part) => Number.parseInt(part, 10));

const compareVersions = (left, right) => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const partCount = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < partCount; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }
  return 0;
};

const isLowerDeploymentTarget = (value, minimumTarget) =>
  typeof value === "string" && compareVersions(value, minimumTarget) < 0;

const reconcileAppDeploymentTarget = (project, deploymentTarget) => {
  for (const config of Object.values(getBuildConfigurations(project))) {
    const currentDeploymentTarget = config?.buildSettings?.IPHONEOS_DEPLOYMENT_TARGET;
    if (isLowerDeploymentTarget(currentDeploymentTarget, deploymentTarget)) {
      config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = deploymentTarget;
    }
  }
};

const withIosDeploymentTarget = (config, deploymentTarget) =>
  withPodfileProperties(config, (modConfig) => {
    modConfig.modResults["ios.deploymentTarget"] = deploymentTarget;
    return modConfig;
  });

const withPodsDeploymentTarget = (config, deploymentTarget) =>
  withPodfile(config, (modConfig) => {
    const patch = buildPodsDeploymentTargetPatch(deploymentTarget);
    if (PODS_DEPLOYMENT_TARGET_PATCH_REGEX.test(modConfig.modResults.contents)) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        PODS_DEPLOYMENT_TARGET_PATCH_REGEX,
        patch.trim()
      );
      return modConfig;
    }
    if (LEGACY_PODS_DEPLOYMENT_TARGET_PATCH_REGEX.test(modConfig.modResults.contents)) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        LEGACY_PODS_DEPLOYMENT_TARGET_PATCH_REGEX,
        `\n${patch}`
      );
      return modConfig;
    }

    const nextContents = modConfig.modResults.contents.replace(
      /(\s+react_native_post_install\([\s\S]*?\n\s+\))/,
      `$1\n${patch}`
    );
    if (nextContents === modConfig.modResults.contents) {
      throw new Error("Unable to inject Fidy pods deployment target patch into Podfile.");
    }
    modConfig.modResults.contents = nextContents;
    return modConfig;
  });

module.exports = {
  reconcileAppDeploymentTarget,
  withIosDeploymentTarget,
  withPodsDeploymentTarget,
};
