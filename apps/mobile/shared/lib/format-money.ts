import type { CopAmount } from "@/shared/types/branded";
import { type CurrencyConfig, getActiveCurrency } from "./currency";

export const MAX_AMOUNT_DIGITS = 11;

const formatterKey = (config: CurrencyConfig): string =>
  `${config.locale}:${config.code}:${config.exponent}`;

const activeCurrency = getActiveCurrency();
const activeCurrencyFormatter = new Intl.NumberFormat(activeCurrency.locale, {
  style: "currency",
  currency: activeCurrency.code,
  maximumFractionDigits: activeCurrency.exponent,
  minimumFractionDigits: activeCurrency.exponent,
});

const formatCurrency = (amount: number, config: CurrencyConfig = activeCurrency): string =>
  formatterKey(config) === formatterKey(activeCurrency)
    ? activeCurrencyFormatter.format(amount)
    : amount.toLocaleString(config.locale, {
        style: "currency",
        currency: config.code,
        maximumFractionDigits: config.exponent,
        minimumFractionDigits: config.exponent,
      });

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
export const formatMoney = (amount: number, config?: CurrencyConfig): string =>
  stripCurrencySpace(formatCurrency(amount, config));

export function formatSignedMoney(amount: number, config?: CurrencyConfig): string;
export function formatSignedMoney(
  amount: number,
  type: "expense" | "income",
  config?: CurrencyConfig
): string;

/**
 * Formats a numeric amount with a sign prefix.
 * 50000 → "+$50.000", -50000 → "-$50.000", 0 → "$0"
 * (50000, "expense") → "-$50.000", (50000, "income") → "+$50.000"
 */
export function formatSignedMoney(
  amount: number,
  typeOrConfig?: "expense" | "income" | CurrencyConfig,
  config?: CurrencyConfig
): string {
  if (typeOrConfig === "expense" || typeOrConfig === "income") {
    const formatted = formatMoney(amount, config);
    return typeOrConfig === "income" ? `+${formatted}` : `-${formatted}`;
  }

  if (amount === 0) return formatMoney(0, typeOrConfig);
  return `${amount > 0 ? "+" : "-"}${formatMoney(Math.abs(amount), typeOrConfig)}`;
}

/**
 * Formats a raw digit string as a currency display string for input fields.
 * "50000" → "$50.000", "" → "$0"
 */
export const formatInputDisplay = (digits: string, config?: CurrencyConfig): string =>
  formatMoney(parseDigitsToAmount(digits), config);
