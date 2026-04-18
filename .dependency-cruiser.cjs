/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-must-not-depend-on-apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "shared-must-not-depend-on-app-routes",
      severity: "error",
      from: { path: "^apps/mobile/shared/" },
      to: { path: "^apps/mobile/app/" },
    },
    {
      name: "shared-must-not-depend-on-features",
      severity: "error",
      from: { path: "^apps/mobile/shared/" },
      to: { path: "^apps/mobile/features/" },
    },
    {
      name: "shared-must-not-depend-on-modules",
      severity: "error",
      from: { path: "^apps/mobile/shared/" },
      to: { path: "^apps/mobile/modules/" },
    },
    {
      name: "app-routes-must-not-be-imported-from-outside-app",
      severity: "error",
      from: { pathNot: "^apps/mobile/app/" },
      to: { path: "^apps/mobile/app/" },
    },
    {
      name: "modules-must-not-depend-on-app-features-or-shared",
      severity: "error",
      from: { path: "^apps/mobile/modules/" },
      to: { path: "^apps/mobile/(app|features|shared)/" },
    },
    {
      name: "mutations-must-not-depend-on-app-routes-or-native-modules",
      severity: "error",
      from: { path: "^apps/mobile/mutations/" },
      to: { path: "^apps/mobile/(app|modules)/" },
    },
    {
      name: "only-app-or-features-may-depend-on-mutations",
      severity: "error",
      from: { pathNot: "^apps/mobile/(app/.+|features/.+)" },
      to: { path: "^apps/mobile/mutations/" },
    },
  ],
  options: {
    includeOnly: "^((apps/mobile)|(packages))/",
    doNotFollow: {
      path: ["node_modules", "\\.expo", "\\.worktrees", "dist", "coverage"],
    },
    tsConfig: {
      fileName: "tsconfig.depcruise.json",
    },
  },
};
