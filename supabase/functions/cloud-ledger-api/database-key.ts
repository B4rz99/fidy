export function readCloudLedgerDatabaseKey(readEnv: (key: string) => string | undefined): string {
  return readEnv("SUPABASE_LEDGER_API_KEY") ?? readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
