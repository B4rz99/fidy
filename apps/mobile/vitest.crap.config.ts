import baseConfig from "./vitest.config";
import { CRAP_EXCLUDE, CRAP_SRC } from "./crap-scope.mjs";

export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    coverage: {
      ...baseConfig.test?.coverage,
      include: CRAP_SRC.map((sourceDir) => `${sourceDir}/**/*.ts`),
      exclude: [...(baseConfig.test?.coverage?.exclude ?? []), ...CRAP_EXCLUDE],
      include: CRAP_SRC.map((sourceDir) => `${sourceDir}/**/*.ts`),
      exclude: [...(baseConfig.test?.coverage?.exclude ?? []), ...CRAP_EXCLUDE],
      thresholds: undefined,
    },
  },
};
