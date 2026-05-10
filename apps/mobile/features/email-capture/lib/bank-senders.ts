import { extractEmailDomain } from "@/shared/lib.public";

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

export function extractDomain(email: string): string {
  return extractEmailDomain(email);
}

export function isBankSender(from: string, senders: readonly BankSender[]): boolean {
  const fromDomain = extractDomain(from);
  return senders.some((s) => extractDomain(s.email) === fromDomain);
}
