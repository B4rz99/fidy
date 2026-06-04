import { buildEmailParserTemplate, normalizeEmailParserText } from "./email-parser-template";
import type {
  EmailParseImprovementRequest,
  LlmParsedTransaction,
  RawEmail,
} from "./email-pipeline-service/types";
import {
  BBVA_DATE_PATTERN,
  BBVA_ESTABLISHMENT_PATTERN,
  BBVA_PAYMENT_PATTERN,
  BBVA_REFERENCE_AMOUNT_PATTERN,
  cleanMerchant,
  DAVIBANK_SHORT_PURCHASE_PATTERN,
  DAVIBANK_TRANSACTION_LINE_PATTERN,
  getReceivedDate,
  KNOWN_BANK_DOMAINS,
  parseCardProductHint,
  parseColombianBankDate,
  parseCopAmount,
  parseMonthDayDate,
  PURCHASE_PATTERN,
} from "./bank-email-parser-helpers";

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

const parseBbvaPaymentMatch = (
  match: RegExpMatchArray,
  text: string,
  email: RawEmail
): LlmParsedTransaction | null => {
  const amount = text.match(BBVA_REFERENCE_AMOUNT_PATTERN)?.[1];
  return buildParsedPurchase({
    merchant: match[4] ?? match[1],
    amount,
    date: match[3] ? parseColombianBankDate(match[3]) : getReceivedDate(email),
    confidence: 0.86,
    cardLast4: match[2],
  });
};

const parseBbvaReferencePurchase = (text: string, email: RawEmail): LlmParsedTransaction | null => {
  const amount = text.match(BBVA_REFERENCE_AMOUNT_PATTERN)?.[1];
  if (!amount) return null;
  const date = text.match(BBVA_DATE_PATTERN)?.[1];
  const establishment = text.match(BBVA_ESTABLISHMENT_PATTERN)?.[1];
  return buildParsedPurchase({
    merchant: establishment,
    amount,
    date: date ? parseColombianBankDate(date) : getReceivedDate(email),
    confidence: 0.84,
  });
};

const parseBbvaPurchase = (text: string, email: RawEmail): LlmParsedTransaction | null => {
  const paymentMatch = text.match(BBVA_PAYMENT_PATTERN);
  if (paymentMatch) {
    const parsed = parseBbvaPaymentMatch(paymentMatch, text, email);
    if (parsed) return parsed;
  }

  return parseBbvaReferencePurchase(text, email);
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

const parseGenericPurchaseMatch = (
  match: RegExpMatchArray,
  text: string,
  email: RawEmail
): LlmParsedTransaction | null => {
  const merchant = match[1]?.trim();
  if (!merchant) return null;
  const amount = match[2] ? parseCopAmount(match[2]) : null;
  if (!amount) return null;
  const date = match[3] ? parseColombianBankDate(match[3]) : getReceivedDate(email);
  if (!date) return null;
  return buildGenericPurchase({
    merchant,
    amount,
    date,
    cardProductHint: parseCardProductHint(text),
  });
};

const buildGenericPurchase = (input: {
  readonly merchant: string;
  readonly amount: number;
  readonly date: string;
  readonly cardProductHint?: string;
}): LlmParsedTransaction => {
  return {
    type: "expense",
    amount: input.amount,
    categoryId: "other",
    description: input.merchant,
    counterpartyHint: input.merchant,
    date: input.date,
    confidence: 0.92,
    ...(input.cardProductHint ? { cardProductHint: input.cardProductHint } : {}),
  };
};

const parsePurchase = (text: string, email: RawEmail): LlmParsedTransaction | null => {
  const match = text.match(PURCHASE_PATTERN);
  return match ? parseGenericPurchaseMatch(match, text, email) : null;
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
