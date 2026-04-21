import type { RawEmail } from "../schema";

export type OutlookMessage = {
  id: string;
  subject: string;
  from: { emailAddress: { address: string } };
  body: { content: string };
  receivedDateTime: string;
};

const sanitizeOutlookEmail = (email: string) => email.replace(/'/g, "''");

function buildSenderFilter(senderEmails: string[]) {
  return senderEmails
    .map((email) => `from/emailAddress/address eq '${sanitizeOutlookEmail(email)}'`)
    .join(" or ");
}

export function buildOutlookFilter(senderEmails: string[], since: string) {
  return `(${buildSenderFilter(senderEmails)}) and receivedDateTime ge ${since}`;
}

export function toRawOutlookEmail(message: OutlookMessage): RawEmail {
  return {
    externalId: message.id,
    from: message.from.emailAddress.address,
    subject: message.subject,
    body: message.body.content,
    receivedAt: message.receivedDateTime,
    provider: "outlook",
  };
}
