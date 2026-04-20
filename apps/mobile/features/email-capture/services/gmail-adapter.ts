// biome-ignore-all lint/style/useNamingConvention: Gmail API uses snake_case
import { captureError, captureWarning } from "@/shared/lib";
import type { RawEmail } from "../schema";

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailPayload = { headers: GmailHeader[]; parts?: GmailPart[]; body?: { data?: string } };
type GmailListResponse = { messages?: { id: string }[] };
type GmailMessageResponse = { payload: GmailPayload };
type GmailJsonResult<T> = { ok: true; data: T } | { ok: false; status: number };

const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_BATCH_SIZE = 5;

const toAuthorizationHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

const fetchGmailJson = async <T>(url: string, token: string): Promise<GmailJsonResult<T>> => {
  const response = await fetch(url, { headers: toAuthorizationHeaders(token) });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  return { ok: true, data: (await response.json()) as T };
};

const toMessageQuery = (since: string, senderEmails: string[]): string => {
  const epoch = Math.floor(new Date(since).getTime() / 1000);
  const senders = senderEmails.map((email) => `from:${email}`).join(" OR ");
  return `(${senders}) after:${epoch}`;
};

const toListUrl = (query: string): string => `${GMAIL_MESSAGES_URL}?q=${encodeURIComponent(query)}`;

const toMessageUrl = (id: string): string => `${GMAIL_MESSAGES_URL}/${id}?format=full`;

const toMessageIds = (listData: GmailListResponse): string[] =>
  (listData.messages ?? []).map((message) => message.id);

const chunkMessageIds = (messageIds: string[]): string[][] =>
  Array.from({ length: Math.ceil(messageIds.length / GMAIL_BATCH_SIZE) }, (_, index) =>
    messageIds.slice(index * GMAIL_BATCH_SIZE, (index + 1) * GMAIL_BATCH_SIZE)
  );

const isFulfilled = <T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> =>
  result.status === "fulfilled";

const isNonNull = <T>(value: T | null): value is T => value != null;

const getHeader = (headers: GmailHeader[], name: string): string =>
  headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value ?? "";

const getMatchingPartData = (part: GmailPart, mime: string): string | null =>
  part.mimeType === mime && part.body?.data ? decodeBase64Url(part.body.data) : null;

const getNestedPartData = (part: GmailPart, mime: string): string | null =>
  part.parts ? findPartByMime(part.parts, mime) : null;

const findPartByMime = (parts: GmailPart[], mime: string): string | null => {
  for (const part of parts) {
    const directMatch = getMatchingPartData(part, mime);
    if (directMatch) return directMatch;

    const nestedMatch = getNestedPartData(part, mime);
    if (nestedMatch) return nestedMatch;
  }

  return null;
};

const extractBodyText = (payload: GmailPayload): string => {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (!payload.parts) return "";

  const plain = findPartByMime(payload.parts, "text/plain");
  if (plain) return plain;

  const html = findPartByMime(payload.parts, "text/html");
  return html ? stripHtml(html) : "";
};

const stripHtml = (html: string): string =>
  html
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

const decodeBase64Url = (data: string): string => {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (error) {
    captureError(error);
    return "";
  }
};

const normalizeSender = (from: string): string => from.match(/<(.+?)>/)?.[1] ?? from;

const normalizeReceivedAt = (date: string): string => {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
};

const fetchGmailMessage = async (token: string, id: string): Promise<RawEmail | null> => {
  const result = await fetchGmailJson<GmailMessageResponse>(toMessageUrl(id), token);
  return result.ok ? parseGmailMessage(id, result.data) : null;
};

const toBatchEmails = (results: PromiseSettledResult<RawEmail | null>[]): RawEmail[] =>
  results
    .filter(isFulfilled)
    .map((result) => result.value)
    .filter(isNonNull);

const collectBatchEmails = async (token: string, batch: string[]): Promise<RawEmail[]> =>
  toBatchEmails(await Promise.allSettled(batch.map((id) => fetchGmailMessage(token, id))));

const appendBatchEmails = async (
  token: string,
  accPromise: Promise<RawEmail[]>,
  batch: string[]
): Promise<RawEmail[]> => {
  const acc = await accPromise;
  const emails = await collectBatchEmails(token, batch);
  return [...acc, ...emails];
};

const collectSequentialEmails = (token: string, messageIds: string[]): Promise<RawEmail[]> =>
  chunkMessageIds(messageIds).reduce<Promise<RawEmail[]>>(
    // Batches must be sequential to respect Gmail API rate limits.
    (accPromise, batch) => appendBatchEmails(token, accPromise, batch),
    Promise.resolve([])
  );

export const fetchGmailEmailsWithToken = async (
  token: string,
  since: string,
  senderEmails: string[]
): Promise<RawEmail[]> => {
  const listResult = await fetchGmailJson<GmailListResponse>(
    toListUrl(toMessageQuery(since, senderEmails)),
    token
  );

  if (!listResult.ok) {
    captureWarning("gmail_api_list_failed", { httpStatus: listResult.status });
    return [];
  }

  const messageIds = toMessageIds(listResult.data);
  return messageIds.length === 0 ? [] : collectSequentialEmails(token, messageIds);
};

const parseGmailMessage = (id: string, msg: GmailMessageResponse): RawEmail | null => {
  const headers = msg.payload.headers;
  const from = getHeader(headers, "From");
  const subject = getHeader(headers, "Subject");
  if (!from || !subject) return null;

  const body = extractBodyText(msg.payload);
  const receivedAt = normalizeReceivedAt(getHeader(headers, "Date"));
  return {
    externalId: id,
    from: normalizeSender(from),
    subject,
    body,
    receivedAt,
    provider: "gmail",
  };
};
