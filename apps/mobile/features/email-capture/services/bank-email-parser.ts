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

const BBVA_PAYMENT_PATTERN =
  /\b(?:operaci[oó]n|operaci&oacute;n)\s*:\s*pago\s+(.+?)\s+(?:tarjeta\s+terminada\s+en\s*:?\s*(?:[*xX\s-]*)?(\d{4}).*?)?(?:fecha\s+de\s+(?:operaci[oó]n|operaci&oacute;n)\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})).*?establecimiento\s*:\s*(.+?)(?=\s*[.;]?\s+(?:si\s+necesitas|c[oó]digos?|c&oacute;digos?|recuerda|ref(?:erencia)?\s*:)|$)/i;

const BBVA_REFERENCE_AMOUNT_PATTERN = /\b(?:ref|referencia)\s*:\s*(?:\$|COP)?\s*([\d.,]+)/i;

const BBVA_DATE_PATTERN =
  /\b(?:fecha|fecha\s+de\s+(?:operaci[oó]n|operaci&oacute;n))\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;

const BBVA_ESTABLISHMENT_PATTERN =
  /\bestablecimiento\s*:\s*(.+?)(?=\s*[.;]?\s+(?:si\s+necesitas|c[oó]digos?|c&oacute;digos?|recuerda|ref(?:erencia)?\s*:)|$)/i;

const DAVIBANK_TRANSACTION_LINE_PATTERN =
  /\b(?:transacci[oó]n|transacci&oacute;n)\s+o\s+compra\s+(.+?)[./]\s*(?:\$|COP)?\s*([\d.,]+)(?:\s+(?:\$|COP)?\s*[\d.,]+)?(?:[/-](\d{1,2})[/-](\d{1,2}))?/i;

const DAVIBANK_SHORT_PURCHASE_PATTERN =
  /\bcompra\s+en\s+(.+?)\s+el\s+(?:\$|COP)?\s*([\d.,]+)\s*(?:[.;]|$)(?=.*\b(?:s[ií]|s&iacute;)\s+no\s+lo\s+hiciste\b)/i;

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

const getReceivedDate = (email: RawEmail): string | null =>
  email.receivedAt.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

const toIsoDateIfValid = (input: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}): string | null => {
  const date = new Date(Date.UTC(input.year, input.month - 1, input.day));
  const isValid =
    date.getUTCFullYear() === input.year &&
    date.getUTCMonth() === input.month - 1 &&
    date.getUTCDate() === input.day;
  const year = String(input.year).padStart(4, "0");
  const month = String(input.month).padStart(2, "0");
  const day = String(input.day).padStart(2, "0");
  return isValid ? `${year}-${month}-${day}` : null;
};

const parseIsoBankDate = (rawDate: string): string | null => {
  const match = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return toIsoDateIfValid({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
};

const parseColombianDayMonthYearDate = (rawDate: string): string | null => {
  const match = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  return toIsoDateIfValid({
    year,
    month: Number(match[2]),
    day: Number(match[1]),
  });
};

const parseColombianBankDate = (rawDate: string): string | null =>
  parseIsoBankDate(rawDate) ?? parseColombianDayMonthYearDate(rawDate);

const parseCardProductHint = (text: string): string | undefined => {
  const last4 = text.match(/\b(?:tarjeta|card)\s+(?:[*xX]+\s*)?(\d{4})\b/i)?.[1];
  return last4 ? `tarjeta ${last4}` : undefined;
};

const cleanMerchant = (merchant: string): string =>
  merchant
    .replace(/\s+/g, " ")
    .replace(/\s*[:;,.]+$/g, "")
    .trim();

const inferPartialDateYear = (input: {
  readonly receivedYear: number;
  readonly receivedMonth: number;
  readonly parsedMonth: number;
}): number => {
  if (input.receivedMonth === 1 && input.parsedMonth === 12) return input.receivedYear - 1;
  return input.receivedYear;
};

const isMonthDayInRange = (month: number, day: number): boolean =>
  Number.isSafeInteger(month) &&
  Number.isSafeInteger(day) &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= 31;

const parseMonthDayDate = (
  rawMonth: string | undefined,
  rawDay: string | undefined,
  email: RawEmail
): string | null => {
  const receivedDate = getReceivedDate(email);
  if (!rawMonth || !rawDay || !receivedDate) return null;
  const receivedYear = Number(receivedDate.slice(0, 4));
  const receivedMonth = Number(receivedDate.slice(5, 7));
  const parsedMonth = Number(rawMonth);
  const parsedDay = Number(rawDay);
  if (!Number.isSafeInteger(receivedYear) || !isMonthDayInRange(parsedMonth, parsedDay)) {
    return null;
  }
  const year = inferPartialDateYear({ receivedYear, receivedMonth, parsedMonth });
  return toIsoDateIfValid({ year, month: parsedMonth, day: parsedDay });
};

const buildParsedPurchase = (input: {
  readonly merchant: string | undefined;
  readonly amount: string | undefined;
  readonly date: string | null;
  readonly confidence: number;
  readonly cardLast4?: string;
}): LlmParsedTransaction | null => {
  const merchant = input.merchant ? cleanMerchant(input.merchant) : "";
  const amount = input.amount ? parseCopAmount(input.amount) : null;
  return merchant && amount && input.date
    ? {
        type: "expense",
        amount,
        categoryId: "other",
        description: merchant,
        counterpartyHint: merchant,
        date: input.date,
        confidence: input.confidence,
        ...(input.cardLast4 ? { cardProductHint: `tarjeta ${input.cardLast4}` } : {}),
      }
    : null;
};

const parseBbvaPurchase = (text: string, email: RawEmail): LlmParsedTransaction | null => {
  const paymentMatch = text.match(BBVA_PAYMENT_PATTERN);
  if (paymentMatch) {
    const amount = text.match(BBVA_REFERENCE_AMOUNT_PATTERN)?.[1];
    const parsed = buildParsedPurchase({
      merchant: paymentMatch[4] ?? paymentMatch[1],
      amount,
      date: paymentMatch[3] ? parseColombianBankDate(paymentMatch[3]) : getReceivedDate(email),
      confidence: 0.86,
      cardLast4: paymentMatch[2],
    });
    if (parsed) return parsed;
  }

  const amount = text.match(BBVA_REFERENCE_AMOUNT_PATTERN)?.[1];
  const date = text.match(BBVA_DATE_PATTERN)?.[1];
  const establishment = text.match(BBVA_ESTABLISHMENT_PATTERN)?.[1];
  return amount
    ? buildParsedPurchase({
        merchant: establishment,
        amount,
        date: date ? parseColombianBankDate(date) : getReceivedDate(email),
        confidence: 0.84,
      })
    : null;
};

const parseDavibankPurchase = (text: string, email: RawEmail): LlmParsedTransaction | null => {
  const shortMatch = text.match(DAVIBANK_SHORT_PURCHASE_PATTERN);
  if (shortMatch) {
    return buildParsedPurchase({
      merchant: shortMatch[1],
      amount: shortMatch[2],
      date: getReceivedDate(email),
      confidence: 0.86,
    });
  }

  const transactionMatch = text.match(DAVIBANK_TRANSACTION_LINE_PATTERN);
  if (transactionMatch) {
    return buildParsedPurchase({
      merchant: transactionMatch[1],
      amount: transactionMatch[2],
      date:
        parseMonthDayDate(transactionMatch[4], transactionMatch[3], email) ??
        getReceivedDate(email),
      confidence: 0.88,
    });
  }
  return null;
};

const parseBankPurchase = (
  parserKey: string,
  text: string,
  email: RawEmail
): LlmParsedTransaction | null => {
  if (parserKey === "bbva") return parseBbvaPurchase(text, email);
  if (parserKey === "davibank") return parseDavibankPurchase(text, email);
  return null;
};

const parsePurchase = (text: string, email: RawEmail): LlmParsedTransaction | null => {
  const match = text.match(PURCHASE_PATTERN);
  const merchant = match?.[1]?.trim();
  const amount = match?.[2] ? parseCopAmount(match[2]) : null;
  const date = match?.[3] ? parseColombianBankDate(match[3]) : getReceivedDate(email);
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
  const bankParsed = parseBankPurchase(bank.parserKey, text, email);
  const parsed = bankParsed ?? parsePurchase(text, email);
  return parsed
    ? { kind: "parsed", parserKey: `${bank.parserKey}:purchase`, parsed }
    : {
        kind: "failed",
        parserKey: bank.parserKey,
        request: buildRegexFailureRequest(email, senderDomain),
      };
};
