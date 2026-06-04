import type { RawEmail } from "./email-pipeline-service/types";

export const KNOWN_BANK_DOMAINS = [
  { domain: "davibank.com", parserKey: "davibank" },
  { domain: "bbvanet.com.co", parserKey: "bbva" },
  { domain: "rappicard.com", parserKey: "rappicard" },
  { domain: "rappi.com", parserKey: "rappicard" },
] as const;

export const PURCHASE_PATTERN =
  /\b(?:compra|purchase|pago|payment)\b(?:\s+aprobada|\s+aprobado|\s+realizada|\s+exitos[ao])?\s+(?:en|at)\s+(.+?)\s+(?:por|for)\s+(?:\$|COP)?\s*([\d.,]+)(?:\s+(?:el|on)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}))?/i;

export const BBVA_PAYMENT_PATTERN =
  /\b(?:operaci[oó]n|operaci&oacute;n)\s*:\s*pago\s+(.+?)\s+(?:tarjeta\s+terminada\s+en\s*:?\s*(?:[*xX\s-]*)?(\d{4}).*?)?(?:fecha\s+de\s+(?:operaci[oó]n|operaci&oacute;n)\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})).*?establecimiento\s*:\s*(.+?)(?=\s*[.;]?\s+(?:si\s+necesitas|c[oó]digos?|c&oacute;digos?|recuerda|ref(?:erencia)?\s*:)|$)/i;

export const BBVA_REFERENCE_AMOUNT_PATTERN = /\b(?:ref|referencia)\s*:\s*(?:\$|COP)?\s*([\d.,]+)/i;

export const BBVA_DATE_PATTERN =
  /\b(?:fecha|fecha\s+de\s+(?:operaci[oó]n|operaci&oacute;n))\s*:\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;

export const BBVA_ESTABLISHMENT_PATTERN =
  /\bestablecimiento\s*:\s*(.+?)(?=\s*[.;]?\s+(?:si\s+necesitas|c[oó]digos?|c&oacute;digos?|recuerda|ref(?:erencia)?\s*:)|$)/i;

export const DAVIBANK_TRANSACTION_LINE_PATTERN =
  /\b(?:transacci[oó]n|transacci&oacute;n)\s+o\s+compra\s+(.+?)[./]\s*(?:\$|COP)?\s*([\d.,]+)(?:\s+(?:\$|COP)?\s*[\d.,]+)?(?:[/-](\d{1,2})[/-](\d{1,2}))?/i;

export const DAVIBANK_SHORT_PURCHASE_PATTERN =
  /\bcompra\s+en\s+(.+?)\s+el\s+(?:\$|COP)?\s*([\d.,]+)\s*(?:[.;]|$)(?=.*\b(?:s[ií]|s&iacute;)\s+no\s+lo\s+hiciste\b)/i;

export const parseCopAmount = (rawAmount: string): number | null => {
  const normalized = rawAmount.replace(/[^\d]/g, "");
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
};

export const getReceivedDate = (email: RawEmail): string | null =>
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

export const parseColombianBankDate = (rawDate: string): string | null =>
  parseIsoBankDate(rawDate) ?? parseColombianDayMonthYearDate(rawDate);

export const parseCardProductHint = (text: string): string | undefined => {
  const last4 = text.match(/\b(?:tarjeta|card)\s+(?:[*xX]+\s*)?(\d{4})\b/i)?.[1];
  return last4 ? `tarjeta ${last4}` : undefined;
};

export const cleanMerchant = (merchant: string): string =>
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

export const parseMonthDayDate = (
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
