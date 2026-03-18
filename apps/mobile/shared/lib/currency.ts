export type CurrencyConfig = {
  readonly code: string;
  readonly symbol: string;
  readonly exponent: number;
  readonly locale: string;
};

const COP: CurrencyConfig = {
  code: "COP",
  symbol: "$",
  exponent: 0,
  locale: "es-CO",
};

export const getActiveCurrency = (): CurrencyConfig => COP;
