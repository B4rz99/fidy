import { captureError } from "@/shared/lib";
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
    const text = await listResponse.text();
    console.warn(`[Gmail] list failed ${listResponse.status}: ${text.slice(0, 200)}`);
    return [];
  }

  const listData = await listResponse.json();
  const messageIds: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);

  if (messageIds.length === 0) return [];

  const Concurrency = 5;
  const emails: RawEmail[] = [];

  for (let i = 0; i < messageIds.length; i += Concurrency) {
    const batch = messageIds.slice(i, i + Concurrency);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgResponse.ok) return null;
        const msg = await msgResponse.json();
        return parseGmailMessage(id, msg);
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) emails.push(r.value);
    }
  }

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

  const emailMatch = from.match(/<(.+?)>/) ?? [null, from];
  const emailAddress = emailMatch[1] ?? from;

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
