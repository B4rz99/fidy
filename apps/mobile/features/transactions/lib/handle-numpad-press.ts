import { MAX_AMOUNT_DIGITS } from "./format-amount";

export const handleNumpadPress = (currentDigits: string, key: string): string => {
  if (key === "delete") {
    return currentDigits.slice(0, -1);
  }

  if (key === "000") {
    return (currentDigits + key).slice(0, MAX_AMOUNT_DIGITS);
  }

  if (/^[0-9]$/.test(key)) {
    return currentDigits.length < MAX_AMOUNT_DIGITS ? currentDigits + key : currentDigits;
  }

  return currentDigits;
};
