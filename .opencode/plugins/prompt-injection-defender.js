module.exports = {
  name: "prompt-injection-defender",
  version: "1.0.0",
  async "tool.execute.after"(input, output) {
    const monitoredTools = new Set(["Read", "WebFetch", "Bash", "Grep", "Glob", "Task"]);
    if (!monitoredTools.has(input.tool)) return;

    const toolResult = output?.output || output?.title || "";
    if (!toolResult || toolResult.length < 10) return;

    const lib = require("../.ai-security/hooks/post-tool-defender-lib.js");

    const config = lib.loadConfig();
    const text = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
    const detections = lib.scanForInjections(text, config);

    if (detections.length > 0) {
      const sourceInfo = lib.getSourceInfo(input.tool, input.args || {});
      const warning = lib.formatWarning(detections, input.tool, sourceInfo);
      return {
        feedback: warning,
      };
    }
  },
};
