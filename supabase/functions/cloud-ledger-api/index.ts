import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCloudLedgerRequest } from "./handler.ts";
import { createCloudLedgerStore } from "./store.ts";
import { createCloudLedgerConsoleTelemetry } from "./telemetry.ts";

const authClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

Deno.serve((request) => {
  const ledgerDatabaseKey =
    Deno.env.get("SUPABASE_LEDGER_API_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ledgerClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", ledgerDatabaseKey);

  return handleCloudLedgerRequest(request, {
    auth: authClient,
    store: createCloudLedgerStore(ledgerClient),
    telemetry: createCloudLedgerConsoleTelemetry(),
  });
});
