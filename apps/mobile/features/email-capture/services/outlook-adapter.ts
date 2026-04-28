// biome-ignore-all lint/style/useNamingConvention: Outlook API uses snake_case
import { captureWarning } from "@/shared/lib";
import type { RawEmail } from "../schema";
import {
  buildOutlookFilter,
  type OutlookMessage,
  toRawOutlookEmail,
} from "./outlook-adapter-utils";

type OutlookListResponse = {
  readonly value?: OutlookMessage[];
  readonly "@odata.nextLink"?: string;
};

const toInitialMessagesUrl = (senderEmails: string[], since: string) =>
  `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(
    buildOutlookFilter(senderEmails, since)
  )}&$select=id,subject,body,from,receivedDateTime`;

export async function fetchOutlookEmailsWithToken(
  token: string,
  since: string,
  senderEmails: string[]
): Promise<RawEmail[]> {
  async function collectPage(url: string): Promise<RawEmail[]> {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!response.ok) {
      captureWarning("outlook_api_list_failed", { httpStatus: response.status });
      return [];
    }

    const data = (await response.json()) as OutlookListResponse;
    const pageEmails = (data.value ?? []).map(toRawOutlookEmail);
    return data["@odata.nextLink"]
      ? [...pageEmails, ...(await collectPage(data["@odata.nextLink"]))]
      : pageEmails;
  }

  return collectPage(toInitialMessagesUrl(senderEmails, since));
}
