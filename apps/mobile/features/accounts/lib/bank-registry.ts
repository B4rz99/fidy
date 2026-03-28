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
  // ── Major banks ──────────────────────────────────────────────────────────────
  {
    bankKey: "bancolombia",
    label: "Bancolombia",
    packages: ["com.todo1.mobile.co.bancolombia"],
    emailDomains: ["notificaciones@bancolombia.com.co", "bancolombia.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Card name or last 4 digits",
  },
  {
    bankKey: "davivienda",
    label: "Davivienda",
    packages: ["com.davivienda.banca"],
    emailDomains: ["davivienda.com"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "banco_bogota",
    label: "Banco de Bogotá",
    packages: ["com.bdb"],
    emailDomains: ["bancadebogota.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "banco_popular",
    label: "Banco Popular",
    packages: [],
    emailDomains: ["bancopopular.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "banco_occidente",
    label: "Banco de Occidente",
    packages: ["com.grupobancolombia.occidente"],
    emailDomains: ["bancodeoccidente.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "av_villas",
    label: "AV Villas",
    packages: [],
    emailDomains: ["avvillas.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
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
    bankKey: "colpatria",
    label: "Scotiabank Colpatria",
    packages: ["com.scotiabank.colpatria"],
    emailDomains: ["colpatria.com", "scotiabankcolpatria.com"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "banco_caja_social",
    label: "Banco Caja Social",
    packages: [],
    emailDomains: ["bancocajasocial.com"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "gnb_sudameris",
    label: "GNB Sudameris",
    packages: [],
    emailDomains: ["gnbsudameris.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "citibank",
    label: "Citibank Colombia",
    packages: [],
    emailDomains: ["citi.com"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "banco_falabella",
    label: "Banco Falabella",
    packages: ["cl.bfalabella.app"],
    emailDomains: ["bancofalabella.com.co"],
    defaultType: "credit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "banco_pichincha",
    label: "Banco Pichincha",
    packages: [],
    emailDomains: ["bancopichincha.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "bancoomeva",
    label: "Bancoomeva",
    packages: [],
    emailDomains: ["bancoomeva.com"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "banco_finandina",
    label: "Banco Finandina",
    packages: [],
    emailDomains: ["bancofinandina.com"],
    defaultType: "credit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
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
    bankKey: "itau",
    label: "Itaú Colombia",
    packages: ["com.itau.co"],
    emailDomains: ["itau.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "mibanco",
    label: "Mibanco",
    packages: [],
    emailDomains: ["mibanco.com.co"],
    defaultType: "debit",
    singleAccount: false,
    identifierHint: "Last 4 digits (e.g., *1234)",
  },
  {
    bankKey: "lulo_bank",
    label: "Lulo Bank",
    packages: ["co.lulobank.app"],
    emailDomains: ["lulobank.com"],
    defaultType: "debit",
    singleAccount: true,
    identifierHint: null,
  },
  {
    bankKey: "nubank",
    label: "Nu Colombia",
    packages: ["com.nu.production"],
    emailDomains: ["nu.com.co"],
    defaultType: "debit",
    singleAccount: true,
    identifierHint: null,
  },
  // ── Digital wallets ───────────────────────────────────────────────────────────
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
    bankKey: "dale",
    label: "dale!",
    packages: ["com.dale.app"],
    emailDomains: ["dale.com.co"],
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
    bankKey: "tpaga",
    label: "Tpaga",
    packages: ["co.tpaga.app"],
    emailDomains: ["tpaga.co"],
    defaultType: "wallet",
    singleAccount: true,
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
