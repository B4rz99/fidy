import type { EmailProvider } from "@/features/email-capture/public";

const EMAIL_PROVIDERS = ["gmail", "outlook"] as const satisfies readonly EmailProvider[];
const SUPPORTED_EMAIL_PROVIDERS = new Set<string>(EMAIL_PROVIDERS);

type EmailConnectionAccount = {
  readonly provider: string;
};

export type EmailConnectionChecklistItem = {
  readonly provider: EmailProvider;
  readonly connected: boolean;
};

export function getEmailConnectionChecklist(
  accounts: readonly EmailConnectionAccount[]
): readonly EmailConnectionChecklistItem[] {
  const connectedProviders = new Set(accounts.map((account) => account.provider));

  return EMAIL_PROVIDERS.map((provider) => ({
    provider,
    connected: connectedProviders.has(provider),
  }));
}

export function hasConnectedEmailAccount(accounts: readonly EmailConnectionAccount[]) {
  return accounts.some((account) => SUPPORTED_EMAIL_PROVIDERS.has(account.provider));
}
