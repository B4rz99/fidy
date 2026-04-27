import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { handlePrivateBackupRequest } from "./handler.ts";
import { createPrivateBackupStore } from "./store.ts";

const authClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

Deno.serve((request) => {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  return handlePrivateBackupRequest(request, {
    auth: authClient,
    rateLimit: (userId) => checkRateLimit(userId, "private-backup-api", 20),
    store: createPrivateBackupStore(serviceClient),
  });
});
