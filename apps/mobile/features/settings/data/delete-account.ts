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
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "delete_failed");
  }
}
