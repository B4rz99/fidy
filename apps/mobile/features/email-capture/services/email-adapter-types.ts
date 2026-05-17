import type { ConnectResult, EmailProvider, RawEmail } from "../schema";

export type EmailProviderConfig = {
  provider: EmailProvider;
  tokenKey: string;
  refreshTokenKey: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  getRedirectUri: () => string;
  profileUrl: string;
  extractEmail: (profile: Record<string, unknown>) => string | null;
  extraAuthParams: Record<string, string>;
  extraTokenExchangeParams: Record<string, string>;
  extraRefreshParams: Record<string, string>;
};

export type FetchEmailsFn = (
  token: string,
  since: string,
  senderEmails: string[]
) => Promise<RawEmail[]>;

export type FetchEmailByIdFn = (token: string, id: string) => Promise<RawEmail | null>;

export type EmailAdapter = {
  isConnected: () => Promise<boolean>;
  connect: (clientId: string) => Promise<ConnectResult>;
  disconnect: () => Promise<void>;
  fetchEmails: (clientId: string, since: string, senderEmails: string[]) => Promise<RawEmail[]>;
  fetchEmailById: (clientId: string, id: string) => Promise<RawEmail | null>;
};
