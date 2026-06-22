export type SupabaseError = { readonly message?: string } | null;

export function throwIfError(error: SupabaseError, operation: string) {
  if (error !== null) {
    throw new Error(`Unable to ${operation}: ${error.message ?? "unknown error"}`);
  }
}
