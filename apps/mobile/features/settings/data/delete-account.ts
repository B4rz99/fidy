export class DeleteAccountLocalCleanupRequiredError extends Error {
  readonly localCleanupRequired = true;

  constructor(message: string) {
    super(message);
    this.name = "DeleteAccountLocalCleanupRequiredError";
  }
}

export function isDeleteAccountLocalCleanupRequiredError(
  error: unknown
): error is DeleteAccountLocalCleanupRequiredError {
  return error instanceof DeleteAccountLocalCleanupRequiredError;
}

export async function deleteAccountRequest(supabaseUrl: string, token: string): Promise<void> {
  const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      // biome-ignore lint/style/useNamingConvention: HTTP header
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      localCleanupRequired?: boolean;
    };
    const message = body.error ?? "delete_failed";
    if (body.localCleanupRequired === true) {
      throw new DeleteAccountLocalCleanupRequiredError(message);
    }
    throw new Error(message);
  }
}
