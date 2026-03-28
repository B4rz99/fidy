import type { AccountType, BankKey } from "../schema";

type BankEntry = {
  readonly bankKey: BankKey;
  readonly label: string;
  readonly packages: readonly string[];
  readonly emailDomains: readonly string[];
  readonly defaultType: AccountType;
  readonly singleAccount: boolean;
  readonly identifierHint: string | null;
};

const BANK_REGISTRY: readonly BankEntry[] = [
  {
    bankKey: "bancolombia",
    label: "Bancolombia",
    packages: ["com.todo1.mobile.co.bancolombia"],
    emailDomains: [],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Card name or last 4 digits",
  },
  {
    bankKey: "davibank",
    label: "Davibank",
    packages: [],
    emailDomains: ["davibank.com"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Card name (e.g., Visa Oro)",
  },
  {
    bankKey: "bbva",
    label: "BBVA",
    packages: ["com.bbva.nxt_colombia"],
    emailDomains: ["bbvanet.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Card name or last 4 digits",
  },
  {
    bankKey: "nequi",
    label: "Nequi",
    packages: ["com.nequi.MobileApp"],
    emailDomains: [],
    defaultType: "wallet",
    singleAccount: true,
    identifierHint: null,
  },
  {
    bankKey: "daviplata",
    label: "Daviplata",
    packages: ["com.davivienda.daviplataapp"],
    emailDomains: [],
    defaultType: "wallet",
    singleAccount: true,
    identifierHint: null,
  },
  {
    bankKey: "rappicard",
    label: "RappiCard",
    packages: ["com.rappi.card"],
    emailDomains: ["rappicard.co"],
    defaultType: "credit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "rappipay",
    label: "RappiPay",
    packages: [],
    emailDomains: ["rappipay.co"],
    defaultType: "wallet",
    singleAccount: false,
    identifierHint: null,
  },
  {
    bankKey: "google_wallet",
    label: "Google Wallet",
    packages: ["com.google.android.apps.walletnfcrel"],
    emailDomains: [],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Card name or last 4 digits",
  },
] as const;

export function resolveBankKeyFromPackage(packageName: string): BankKey | null {
  const entry = BANK_REGISTRY.find((b) => b.packages.includes(packageName));
  return entry?.bankKey ?? null;
}

export function resolveBankKeyFromDomain(domain: string): BankKey | null {
  const lower = domain.toLowerCase();
  const entry = BANK_REGISTRY.find((b) => b.emailDomains.some((d) => d.toLowerCase() === lower));
  return entry?.bankKey ?? null;
}

export function getBankDefaults(bankKey: BankKey): BankEntry {
  const entry = BANK_REGISTRY.find((b) => b.bankKey === bankKey);
  return (
    entry ?? {
      bankKey: "other" as BankKey,
      label: "Other",
      packages: [],
      emailDomains: [],
      defaultType: "debit" as AccountType,
      singleAccount: false,
      identifierHint: null,
    }
  );
}

export function isSingleAccountBank(bankKey: BankKey): boolean {
  return getBankDefaults(bankKey).singleAccount;
}

export function getAllBanks(): readonly BankEntry[] {
  return BANK_REGISTRY;
}
