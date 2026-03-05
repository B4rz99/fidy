export type BankSender = {
  readonly bank: string;
  readonly email: string;
};

export const DEFAULT_BANK_SENDERS: readonly BankSender[] = [
  { bank: "Davibank", email: "davibankinforma@davibank.com" },
  { bank: "BBVA", email: "BBVA@bbvanet.com.co" },
  { bank: "Rappi", email: "noreply@rappicard.co" },
] as const;

export function isBankSender(from: string, senders: readonly BankSender[]): boolean {
  const normalized = from.toLowerCase();
  return senders.some((s) => s.email.toLowerCase() === normalized);
}
