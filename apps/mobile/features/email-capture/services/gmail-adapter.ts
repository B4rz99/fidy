// biome-ignore-all lint/style/useNamingConvention: Gmail API uses snake_case
import { captureError, captureWarning } from "@/shared/lib";
import type { RawEmail } from "../schema";

export async function fetchGmailEmailsWithToken(
  token: string,
  since: string,
  senderEmails: string[]
): Promise<RawEmail[]> {
  const epoch = Math.floor(new Date(since).getTime() / 1000);
  const fromQuery = senderEmails.map((e) => `from:${e}`).join(" OR ");
  const query = `(${fromQuery}) after:${epoch}`;

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listResponse.ok) {
    captureWarning("gmail_api_list_failed", { httpStatus: listResponse.status });
    return [];
  }

  const listData = (await listResponse.json()) as { messages?: { id: string }[] };
  const messageIds: string[] = (listData.messages ?? []).map((m) => m.id);

  if (messageIds.length === 0) return [];

  const Concurrency = 5;
  const chunks = Array.from({ length: Math.ceil(messageIds.length / Concurrency) }, (_, i) =>
    messageIds.slice(i * Concurrency, (i + 1) * Concurrency)
  );

  // Batches must be sequential to respect Gmail API rate limits.
  const emails = await chunks.reduce<Promise<RawEmail[]>>(async (accPromise, batch) => {
    const acc = await accPromise;
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgResponse.ok) return null;
        const msg = (await msgResponse.json()) as { payload: GmailPayload };
        return parseGmailMessage(id, msg);
      })
    );
    const fulfilled = results
      .filter((r): r is PromiseFulfilledResult<RawEmail | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((v): v is RawEmail => v != null);
    return [...acc, ...fulfilled];
  }, Promise.resolve([]));

  return emails;
}

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailPayload = { headers: GmailHeader[]; parts?: GmailPart[]; body?: { data?: string } };

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBodyText(payload: GmailPayload): string {
  // Try top-level body first
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (!payload.parts) return "";

  // Prefer text/plain
  const plain = findPartByMime(payload.parts, "text/plain");
  if (plain) return plain;

  // Fall back to text/html with tags stripped (bank emails are often HTML-only)
  const html = findPartByMime(payload.parts, "text/html");
  if (html) return stripHtml(html);

  return "";
}

function findPartByMime(parts: GmailPart[], mime: string): string | null {
  for (const part of parts) {
    if (part.mimeType === mime && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      const nested = findPartByMime(part.parts, mime);
      if (nested) return nested;
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#?\w+;/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (error) {
    captureError(error);
    return "";
  }
}

function parseGmailMessage(id: string, msg: { payload: GmailPayload }): RawEmail | null {
  const headers = msg.payload.headers;
  const from = getHeader(headers, "From");
  const subject = getHeader(headers, "Subject");
  const dateStr = getHeader(headers, "Date");
  const body = extractBodyText(msg.payload);

  if (!from || !subject) return null;

  const emailMatch = from.match(/<(.+?)>/);
  const emailAddress = emailMatch?.[1] ?? from;

  const parsedDate = new Date(dateStr);
  const receivedAt = Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString()
    : parsedDate.toISOString();

  return {
    externalId: id,
    from: emailAddress,
    subject,
    body,
    receivedAt,
    provider: "gmail",
  };
}
