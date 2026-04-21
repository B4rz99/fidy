// biome-ignore-all lint/style/useNamingConvention: OAuth/HTTP APIs use snake_case parameter names
import type { EmailProvider } from "../schema";
import { EMAIL_REDIRECT_URI, getGmailRedirectUri } from "../schema";
import { createAdapter } from "./create-email-adapter";
import type { EmailAdapter, EmailProviderConfig } from "./email-adapter-types";
import { fetchGmailEmailsWithToken } from "./gmail-adapter";
import { fetchOutlookEmailsWithToken } from "./outlook-adapter";

const gmailConfig: EmailProviderConfig = {
  provider: "gmail",
  tokenKey: "email-gmail-token",
  refreshTokenKey: "email-gmail-refresh-token",
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scope: "https://www.googleapis.com/auth/gmail.readonly",
  getRedirectUri: getGmailRedirectUri,
  profileUrl: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
  extractEmail: (profile) =>
    typeof profile.emailAddress === "string" ? profile.emailAddress : null,
  extraAuthParams: { access_type: "offline", prompt: "consent" },
  extraTokenExchangeParams: {},
  extraRefreshParams: {},
};

const outlookConfig: EmailProviderConfig = {
  provider: "outlook",
  tokenKey: "email-outlook-token",
  refreshTokenKey: "email-outlook-refresh-token",
  authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  scope: "Mail.Read User.Read",
  getRedirectUri: () => EMAIL_REDIRECT_URI,
  profileUrl: "https://graph.microsoft.com/v1.0/me",
  extractEmail: (profile) => {
    const mail = typeof profile.mail === "string" ? profile.mail : null;
    const upn = typeof profile.userPrincipalName === "string" ? profile.userPrincipalName : null;
    return mail ?? upn;
  },
  extraAuthParams: { prompt: "consent" },
  extraTokenExchangeParams: { scope: "Mail.Read User.Read" },
  extraRefreshParams: { scope: "Mail.Read User.Read" },
};

const adapters: Record<EmailProvider, EmailAdapter> = {
  gmail: createAdapter(gmailConfig, fetchGmailEmailsWithToken),
  outlook: createAdapter(outlookConfig, fetchOutlookEmailsWithToken),
};

export function getAdapter(provider: EmailProvider): EmailAdapter {
  return adapters[provider];
}
