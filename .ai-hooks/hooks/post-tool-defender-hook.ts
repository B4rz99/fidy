export interface HookInput {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResponse?: unknown;
  toolResult?: unknown;
}

export const MONITORED_TOOLS = new Set(["Read", "WebFetch", "Bash", "Grep", "Glob", "Task"]);

export function extractTextContent(toolResult: unknown): string {
  if (toolResult === null || toolResult === undefined) {
    return "";
  }

  if (typeof toolResult === "string") {
    return toolResult;
  }

  if (Array.isArray(toolResult)) {
    return toolResult.map((item) => extractTextContent(item)).filter(Boolean).join("\n");
  }

  if (typeof toolResult === "object") {
    const result = toolResult as Record<string, unknown>;

    if ("content" in result) {
      const content = result.content;
      if (typeof content === "string") {
        return content;
      }

      if (Array.isArray(content)) {
        return content
          .map((block) => {
            if (typeof block === "string") {
              return block;
            }

            if (typeof block === "object" && block && "text" in block) {
              const text = (block as Record<string, unknown>).text;
              return text == null ? "" : String(text);
            }

            return "";
          })
          .filter(Boolean)
          .join("\n");
      }
    }

    for (const key of ["output", "result", "text", "stdout", "data"]) {
      if (key in result && result[key] != null) {
        const value = result[key];
        return typeof value === "string" ? value : String(value);
      }
    }

    try {
      return JSON.stringify(result);
    } catch {
      return String(result);
    }
  }

  return String(toolResult);
}

export function normalizeHookInput(input: Record<string, unknown>): HookInput | null {
  const toolName = input.tool_name;
  const toolInput = input.tool_input;

  if (
    typeof toolName !== "string" ||
    typeof toolInput !== "object" ||
    toolInput === null ||
    Array.isArray(toolInput)
  ) {
    return null;
  }

  return {
    toolName,
    toolInput: toolInput as Record<string, unknown>,
    toolResponse: input.tool_response,
    toolResult: input.tool_result,
  };
}
