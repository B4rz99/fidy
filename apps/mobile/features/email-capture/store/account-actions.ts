import type { AnyDb } from "@/shared/db";
import { generateEmailAccountId, toIsoDateTime } from "@/shared/lib";
import type { UserId } from "@/shared/types/branded";
import type { EmailAccountRow } from "../lib/repository";
import { deleteEmailAccount, insertEmailAccount } from "../lib/repository";
import type { EmailProvider } from "../schema";
import { getAdapter } from "../services/email-adapter";
import {
  createEmailCaptureSession,
  isActiveEmailCaptureSession,
} from "../services/email-capture-store-runtime";
import { isManagedEmailProvider, resolveEmailAccountId, useEmailCaptureStore } from "./state";

export async function connectEmailAccount(
  db: AnyDb,
  userId: UserId,
  provider: EmailProvider,
  clientId: string
): Promise<void> {
  const session = createEmailCaptureSession(userId);
  if (!isActiveEmailCaptureSession(session)) return;

  const result = await getAdapter(provider).connect(clientId);
  if (!result.success || !isActiveEmailCaptureSession(session)) return;

  const normalizedEmail = result.email.toLowerCase();
  const alreadyConnected = useEmailCaptureStore
    .getState()
    .accounts.some((account) => account.email.toLowerCase() === normalizedEmail);
  if (alreadyConnected) return;

  const row: EmailAccountRow = {
    id: generateEmailAccountId(),
    userId,
    provider,
    email: normalizedEmail,
    lastFetchedAt: null,
    createdAt: toIsoDateTime(new Date()),
  };

  const inserted = await insertEmailAccount(db, row);
  if (!inserted) return;
  if (!isActiveEmailCaptureSession(session)) return;
  useEmailCaptureStore.getState().appendAccount(row);
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
