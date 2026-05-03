import type { AnyDb } from "@/shared/db";
import { captureWarning, generateEmailAccountId, toIsoDateTime } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type { EmailAccountRow } from "../lib/repository";
import { deleteEmailAccount, insertEmailAccount } from "../lib/repository";
import type { ConnectResult, EmailProvider } from "../schema";
import { getAdapter } from "../services/email-adapter";
import {
  createEmailCaptureSession,
  isActiveEmailCaptureSession,
} from "../services/email-capture-store-runtime";
import { isManagedEmailProvider, resolveEmailAccountId, useEmailCaptureStore } from "./state";

export type ConnectEmailAccountOutcome =
  | { readonly connected: true }
  | {
      readonly connected: false;
      readonly reason:
        | "missing_context"
        | "cancelled"
        | "token_exchange_failed"
        | "profile_fetch_failed"
        | "no_email_found"
        | "duplicate_account"
        | "database_rejected"
        | "stale_session"
        | "invalid_callback"
        | "no_code"
        | "unknown";
    };

const toConnectFailureReason = (
  error: Extract<ConnectResult, { success: false }>["error"]
): Extract<ConnectEmailAccountOutcome, { connected: false }>["reason"] => {
  if (
    error === "cancelled" ||
    error === "token_exchange_failed" ||
    error === "profile_fetch_failed" ||
    error === "no_email_found" ||
    error === "invalid_callback" ||
    error === "no_code"
  ) {
    return error;
  }

  return "unknown";
};

const failConnect = (
  provider: EmailProvider,
  reason: Extract<ConnectEmailAccountOutcome, { connected: false }>["reason"]
): ConnectEmailAccountOutcome => {
  captureWarning("email_account_connect_failed", { provider, reason });
  return { connected: false, reason };
};

export async function connectEmailAccount(
  db: AnyDb,
  userId: UserId,
  provider: EmailProvider,
  clientId: string
): Promise<ConnectEmailAccountOutcome> {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) return failConnect(provider, "missing_context");

  const result = await getAdapter(provider).connect(clientId);
  if (!result.success) return failConnect(provider, toConnectFailureReason(result.error));
  if (!isActiveEmailCaptureSession(session)) return failConnect(provider, "stale_session");

  const normalizedEmail = result.email.toLowerCase();
  const alreadyConnected = useEmailCaptureStore
    .getState()
    .accounts.some((account) => account.email.toLowerCase() === normalizedEmail);
  if (alreadyConnected) return failConnect(provider, "duplicate_account");

  const row: EmailAccountRow = {
    id: generateEmailAccountId(),
    userId,
    provider,
    email: normalizedEmail,
    lastFetchedAt: null,
    createdAt: toIsoDateTime(new Date()),
  };

  const inserted = await insertEmailAccount(db, row);
  if (!inserted) return failConnect(provider, "database_rejected");
  if (!isActiveEmailCaptureSession(session)) return failConnect(provider, "stale_session");
  useEmailCaptureStore.getState().appendAccount(row);
  return { connected: true };
}

export async function disconnectEmailAccount(
  db: AnyDb,
  userId: UserId,
  emailAccountId: string
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) return;

  const account = useEmailCaptureStore
    .getState()
    .accounts.find((candidate) => candidate.id === emailAccountId);
  const accountId = resolveEmailAccountId(account, emailAccountId);
  if (isManagedEmailProvider(account?.provider)) {
    await getAdapter(account.provider).disconnect();
    if (!isActiveEmailCaptureSession(session)) return;
  }

  await deleteEmailAccount(db, accountId);
  if (!isActiveEmailCaptureSession(session)) return;
  useEmailCaptureStore.getState().removeAccount(accountId);
}
