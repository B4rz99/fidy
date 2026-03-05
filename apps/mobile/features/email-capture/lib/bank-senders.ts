export type BankSender = {
  readonly bank: string;
  readonly email: string;
};

export const DEFAULT_BANK_SENDERS: readonly BankSender[] = [
  { bank: "Bancolombia", email: "notificaciones@bancolombia.com.co" },
  { bank: "Nequi", email: "nequi@bancolombia.com.co" },
  { bank: "Davivienda", email: "alertas@davivienda.com" },
  { bank: "Daviplata", email: "notificaciones@daviplata.com" },
  { bank: "BBVA", email: "notificaciones@bbva.com.co" },
  { bank: "Banco de Bogota", email: "alertas@bancodebogota.com.co" },
  { bank: "Scotiabank Colpatria", email: "alertas@colpatria.com" },
] as const;

export function isBankSender(from: string, senders: readonly BankSender[]): boolean {
  const normalized = from.toLowerCase();
  return senders.some((s) => s.email.toLowerCase() === normalized);
}
