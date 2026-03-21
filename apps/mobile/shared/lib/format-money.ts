import type { CopAmount } from "@/shared/types/branded";
import { type CurrencyConfig, getActiveCurrency } from "./currency";

export const MAX_AMOUNT_DIGITS = 11;

const makeFormatter = (config: CurrencyConfig): Intl.NumberFormat =>
  new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    maximumFractionDigits: config.exponent,
    minimumFractionDigits: config.exponent,
  });

const defaultFormatter = makeFormatter(getActiveCurrency());

const getFormatter = (config?: CurrencyConfig): Intl.NumberFormat =>
  config ? makeFormatter(config) : defaultFormatter;

/** Remove locale-inserted whitespace between currency symbol and number. */
const stripCurrencySpace = (formatted: string): string => formatted.replace(/\s+/g, "");

/**
 * Strips non-digit characters and caps at MAX_AMOUNT_DIGITS digits for amount input.
 */
export const cleanDigitInput = (text: string): string =>
  text.replace(/[^0-9]/g, "").slice(0, MAX_AMOUNT_DIGITS);

/**
 * Parses a raw digit string to a numeric amount.
 * "50000" → 50000, "" → 0
 */
export const parseDigitsToAmount = (digits: string): CopAmount => {
  const cleaned = digits.replace(/[^0-9]/g, "");
  return (Number.parseInt(cleaned, 10) || 0) as CopAmount;
};

/**
 * Formats a numeric amount as a currency display string.
 * 50000 → "$50.000", 0 → "$0"
 */
export const formatMoney = (amount: CopAmount, config?: CurrencyConfig): string =>
  stripCurrencySpace(getFormatter(config).format(amount));

/**
 * Formats a numeric amount with a sign prefix based on transaction type.
 * (50000, "expense") → "-$50.000", (50000, "income") → "+$50.000"
 */
export const formatSignedMoney = (
  amount: CopAmount,
  type: "expense" | "income",
  config?: CurrencyConfig
): string => {
  const formatted = formatMoney(amount, config);
  return type === "income" ? `+${formatted}` : `-${formatted}`;
};

/**
 * Formats a raw digit string as a currency display string for input fields.
 * "50000" → "$50.000", "" → "$0"
 */
export const formatInputDisplay = (digits: string, config?: CurrencyConfig): string =>
  formatMoney(parseDigitsToAmount(digits), config);
