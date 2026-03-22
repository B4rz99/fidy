// biome-ignore-all lint/style/useNamingConvention: Outlook API uses snake_case
import { captureWarning } from "@/shared/lib";
import type { RawEmail } from "../schema";

export async function fetchOutlookEmailsWithToken(
  token: string,
  since: string,
  senderEmails: string[]
): Promise<RawEmail[]> {
  const sanitize = (e: string) => e.replace(/'/g, "''");
  const senderFilter = senderEmails
    .map((e) => `from/emailAddress/address eq '${sanitize(e)}'`)
    .join(" or ");
  const dateFilter = `receivedDateTime ge '${since}'`;
  const filter = `(${senderFilter}) and ${dateFilter}`;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,body,from,receivedDateTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    captureWarning("outlook_api_list_failed", { httpStatus: response.status });
    return [];
  }

  const data = await response.json();
  const messages: OutlookMessage[] = data.value ?? [];

  return messages.map((msg) => ({
    externalId: msg.id,
    from: msg.from.emailAddress.address,
    subject: msg.subject,
    body: msg.body.content,
    receivedAt: msg.receivedDateTime,
    provider: "outlook" as const,
  }));
}

type OutlookMessage = {
  id: string;
  subject: string;
  from: { emailAddress: { address: string } };
  body: { content: string };
  receivedDateTime: string;
};
