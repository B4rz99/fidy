import { buildEmailParserTemplate, normalizeEmailParserText } from "./email-parser-template";
import type {
  EmailParseImprovementRequest,
  LlmParsedTransaction,
  RawEmail,
} from "./email-pipeline-service/types";

type ParsedBankEmail = {
  readonly kind: "parsed";
  readonly parserKey: string;
  readonly parsed: LlmParsedTransaction;
};

type FailedBankEmail = {
  readonly kind: "failed";
  readonly parserKey: string;
  readonly request: EmailParseImprovementRequest;
};

type UnsupportedBankEmail = {
  readonly kind: "unsupported";
};

type BankEmailParseResult = ParsedBankEmail | FailedBankEmail | UnsupportedBankEmail;

const KNOWN_BANK_DOMAINS = [
  { domain: "davibank.com", parserKey: "davibank" },
  { domain: "bbvanet.com.co", parserKey: "bbva" },
  { domain: "rappicard.com", parserKey: "rappicard" },
  { domain: "rappi.com", parserKey: "rappicard" },
] as const;

const PURCHASE_PATTERN =
  /\b(?:compra|purchase|pago|payment)\b(?:\s+aprobada|\s+aprobado|\s+realizada|\s+exitos[ao])?\s+(?:en|at)\s+(.+?)\s+(?:por|for)\s+(?:\$|COP)?\s*([\d.,]+)(?:\s+(?:el|on)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}))?/i;

export const buildEmailParseImprovementRawText = (email: RawEmail): string =>
  [email.subject, email.body].filter((part) => part.trim().length > 0).join("\n\n");

export const getEmailSenderDomain = (email: Pick<RawEmail, "from">): string | null =>
  email.from.match(/@([^>\s]+)(?:>|$)/)?.[1]?.toLowerCase() ?? null;

const getKnownBank = (email: RawEmail) => {
  const senderDomain = getEmailSenderDomain(email);
  return {
    senderDomain,
    bank: KNOWN_BANK_DOMAINS.find(
      (entry) => senderDomain === entry.domain || senderDomain?.endsWith(`.${entry.domain}`)
    ),
  };
};

const parseCopAmount = (rawAmount: string): number | null => {
  const normalized = rawAmount.replace(/[^\d]/g, "");
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

const parseDate = (rawDate: string): string | null => {
  const match = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return null;
  const rawDay = match[1];
  const rawMonth = match[2];
  const rawYear = match[3];
  if (!rawDay || !rawMonth || !rawYear) return null;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const month = rawMonth.padStart(2, "0");
  const day = rawDay.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getReceivedDate = (email: RawEmail): string | null =>
  email.receivedAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

const parseCardProductHint = (text: string): string | undefined => {
  const last4 = text.match(/\b(?:tarjeta|card)\s+(?:[*xX]+\s*)?(\d{4})\b/i)?.[1];
  return last4 ? `tarjeta ${last4}` : undefined;
};

const parsePurchase = (text: string, email: RawEmail): LlmParsedTransaction | null => {
  const match = text.match(PURCHASE_PATTERN);
  const merchant = match?.[1]?.trim();
  const amount = match?.[2] ? parseCopAmount(match[2]) : null;
  const date = match?.[3] ? parseDate(match[3]) : getReceivedDate(email);
  const cardProductHint = parseCardProductHint(text);
  return merchant && amount && date
    ? {
        type: "expense",
        amount,
        categoryId: "other",
        description: merchant,
        counterpartyHint: merchant,
        date,
        confidence: 0.92,
        ...(cardProductHint ? { cardProductHint } : {}),
      }
    : null;
};

const buildRegexFailureRequest = (
  email: RawEmail,
  senderDomain: string | null
): EmailParseImprovementRequest => {
  const rawText = buildEmailParseImprovementRawText(email);
  return {
    rawText,
    parserTemplate: buildEmailParserTemplate(rawText),
    senderDomain,
    source: email.provider === "gmail" ? "email_gmail" : "email_outlook",
    status: "failed",
    confidence: null,
    parseMethod: "regex",
  };
};

export const parseKnownBankEmail = (email: RawEmail): BankEmailParseResult => {
  const { senderDomain, bank } = getKnownBank(email);
  if (!bank) return { kind: "unsupported" };

  const text = normalizeEmailParserText(buildEmailParseImprovementRawText(email));
  const parsed = parsePurchase(text, email);
  return parsed
    ? { kind: "parsed", parserKey: `${bank.parserKey}:purchase`, parsed }
    : {
        kind: "failed",
        parserKey: bank.parserKey,
        request: buildRegexFailureRequest(email, senderDomain),
      };
};
