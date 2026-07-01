export function classifyAiChatInternalError(err: unknown): string {
  const status = readHttpStatus(err);
  if (hasOpenAiErrorFields(err)) {
    return status === null ? "openai_error" : `openai_error:status_${status}`;
  }

  if (err instanceof SyntaxError) {
    return "syntax_error";
  }
  if (err instanceof TypeError) {
    return "type_error";
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return "abort_error";
  }
  return err instanceof Error ? "internal_error" : "unknown_error";
}

function hasOpenAiErrorFields(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ("status" in err || "code" in err || "param" in err || "type" in err)
  );
}

function readHttpStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null || !("status" in err)) {
    return null;
  }
  const status = (err as Record<string, unknown>).status;
  const value = typeof status === "number" ? status : Number(status);
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}
