import { defineConfig } from "crap4ts";
import { CRAP_EXCLUDE, CRAP_SRC } from "./crap-scope.mjs";

export default defineConfig({
  threshold: 8,
  coverageMetric: "line",
  top: 30,
  src: CRAP_SRC,
  exclude: CRAP_EXCLUDE,
});
