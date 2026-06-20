export type BankSender = {
  readonly bank: string;
  readonly email: string;
};

export const DEFAULT_BANK_SENDERS: readonly BankSender[] = [
  { bank: "Davibank", email: "davibankinforma@davibank.com" },
  { bank: "BBVA", email: "BBVA@bbvanet.com.co" },
  { bank: "RappiCard", email: "noreply@rappicard.co" },
  { bank: "RappiPay", email: "noreply@rappipay.co" },
] as const;
