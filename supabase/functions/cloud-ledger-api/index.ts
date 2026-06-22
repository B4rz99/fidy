import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCloudLedgerRequest } from "./handler.ts";
import { createCloudLedgerStore } from "./store.ts";

const authClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

Deno.serve((request) => {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  return handleCloudLedgerRequest(request, {
    auth: authClient,
    store: createCloudLedgerStore(serviceClient),
  });
});
