export type LocalParseResult = {
  amount: number;
  merchant: string;
  type: "expense" | "income";
};

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$\s]/g, "");
  const normalized = cleaned.replace(/[.,](?=\d{3}(?:\D|$))/g, "");
  const match = normalized.match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const pesos = parseInt(match[1], 10);
  return pesos;
}

const BANCOLOMBIA_PURCHASE = /compra\s+por\s+\$?([\d.,]+)\s+en\s+(.+?)(?:\.\s|$)/i;
const BANCOLOMBIA_TRANSFER_OUT = /transferencia\s+por\s+\$?([\d.,]+)\s+a\s+(.+?)(?:\.\s|$)/i;
const BANCOLOMBIA_TRANSFER_IN = /transferencia\s+por\s+\$?([\d.,]+)\s+de\s+(.+?)(?:\.\s|$)/i;
const BANCOLOMBIA_DEPOSIT = /(?:dep[oó]sito|abono)\s+por\s+\$?([\d]+(?:[.,]\d+)*)/i;

const BBVA_PURCHASE = /compra\s+(?:aprobada\s+)?por\s+\$?([\d.,]+)\s+en\s+(.+?)(?:\.\s|$)/i;

const NEQUI_SENT = /enviaste\s+\$?([\d.,]+)\s+a\s+(.+?)(?:\.\s|$)/i;
const NEQUI_RECEIVED = /recibiste\s+\$?([\d.,]+)\s+de\s+(.+?)(?:\.\s|$)/i;

const DAVIPLATA_PURCHASE = /pagaste\s+\$?([\d.,]+)\s+en\s+(.+?)(?:\.\s|$)/i;
const DAVIPLATA_RECEIVED = /recibiste\s+\$?([\d.,]+)\s+de\s+(.+?)(?:\.\s|$)/i;

const GOOGLE_WALLET_EN = /payment\s+of\s+\$?([\d.,]+)\s+at\s+(.+?)(?:\.\s|$)/i;
const GOOGLE_WALLET_ES = /pago\s+(?:de\s+)?\$?([\d.,]+)\s+en\s+(.+?)(?:\.\s|$)/i;

const GENERIC_PURCHASE = /por\s+\$?([\d.,]+)\s+en\s+(.+?)(?:\.\s|$)/i;

type PatternEntry = {
  pattern: RegExp;
  type: "expense" | "income";
  amountGroup: number;
  merchantGroup: number;
};

const PATTERNS: ReadonlyArray<PatternEntry> = [
  { pattern: BANCOLOMBIA_PURCHASE, type: "expense", amountGroup: 1, merchantGroup: 2 },
  { pattern: BANCOLOMBIA_TRANSFER_OUT, type: "expense", amountGroup: 1, merchantGroup: 2 },
  { pattern: BANCOLOMBIA_TRANSFER_IN, type: "income", amountGroup: 1, merchantGroup: 2 },
  { pattern: BANCOLOMBIA_DEPOSIT, type: "income", amountGroup: 1, merchantGroup: -1 },
  { pattern: BBVA_PURCHASE, type: "expense", amountGroup: 1, merchantGroup: 2 },
  { pattern: NEQUI_SENT, type: "expense", amountGroup: 1, merchantGroup: 2 },
  { pattern: NEQUI_RECEIVED, type: "income", amountGroup: 1, merchantGroup: 2 },
  { pattern: DAVIPLATA_PURCHASE, type: "expense", amountGroup: 1, merchantGroup: 2 },
  { pattern: DAVIPLATA_RECEIVED, type: "income", amountGroup: 1, merchantGroup: 2 },
  { pattern: GOOGLE_WALLET_EN, type: "expense", amountGroup: 1, merchantGroup: 2 },
  { pattern: GOOGLE_WALLET_ES, type: "expense", amountGroup: 1, merchantGroup: 2 },
  { pattern: GENERIC_PURCHASE, type: "expense", amountGroup: 1, merchantGroup: 2 },
];

function tryParseEntry(combined: string, entry: PatternEntry): LocalParseResult | null {
  const match = combined.match(entry.pattern);
  if (!match) return null;

  const rawAmount = match[entry.amountGroup];
  const amount = parseAmount(rawAmount);
  if (!amount || amount <= 0) return null;

  const rawMerchant =
    entry.merchantGroup === -1
      ? "Depósito"
      : match[entry.merchantGroup].trim().replace(/[.\s]+$/, "");

  if (rawMerchant.length === 0) return null;

  return { amount, merchant: rawMerchant, type: entry.type };
}

export function parseNotificationLocally(text: string): LocalParseResult | null {
  const combined = text.trim();
  if (combined.length === 0) return null;

  return PATTERNS.reduce<LocalParseResult | null>(
    (found, entry) => found ?? tryParseEntry(combined, entry),
    null
  );
}
