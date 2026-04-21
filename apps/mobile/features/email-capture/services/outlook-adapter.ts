// biome-ignore-all lint/style/useNamingConvention: Outlook API uses snake_case
import { captureWarning } from "@/shared/lib";
import type { RawEmail } from "../schema";
import {
  buildOutlookFilter,
  type OutlookMessage,
  toRawOutlookEmail,
} from "./outlook-adapter-utils";

export async function fetchOutlookEmailsWithToken(
  token: string,
  since: string,
  senderEmails: string[]
): Promise<RawEmail[]> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(
      buildOutlookFilter(senderEmails, since)
    )}&$select=id,subject,body,from,receivedDateTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    captureWarning("outlook_api_list_failed", { httpStatus: response.status });
    return [];
  }

  const data = (await response.json()) as { value?: OutlookMessage[] };
  const messages: OutlookMessage[] = data.value ?? [];

  return messages.map(toRawOutlookEmail);
}
