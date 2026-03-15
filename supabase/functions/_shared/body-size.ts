type BodyResult = { ok: true; text: string } | { ok: false };

export async function readBodyWithLimit(req: Request, maxBytes = 10240): Promise<BodyResult> {
  const contentLength = req.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return { ok: false };
  }

  const reader = req.body?.getReader();
  if (!reader) {
    return { ok: true, text: "" };
  }

  const decoder = new TextDecoder();
  const parts: string[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel();
      return { ok: false };
    }
    parts.push(decoder.decode(value, { stream: true }));
  }
  parts.push(decoder.decode());

  return { ok: true, text: parts.join("") };
}
