const allowedLocales = new Set(["en", "es"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sendJson = (response, status, body) => {
  response.status(status).setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
};

const readConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
};

const parseBody = (request) => {
  const body = typeof request.body === "object" && request.body !== null ? request.body : {};
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale = allowedLocales.has(body?.locale) ? body.locale : "en";

  return emailPattern.test(email) ? { email, locale } : null;
};

const addWaitlistEmail = ({ supabaseUrl, supabaseAnonKey }, body) =>
  fetch(`${supabaseUrl}/rest/v1/waitlist_emails`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const config = readConfig();
  const body = parseBody(request);

  if (!config) {
    return sendJson(response, 500, { error: "Waitlist is not configured" });
  }

  if (!body) {
    return sendJson(response, 400, { error: "Invalid email" });
  }

  const supabaseResponse = await addWaitlistEmail(config, body);

  if (supabaseResponse.status === 201 || supabaseResponse.status === 409) {
    return response.status(supabaseResponse.status).end();
  }

  return sendJson(response, 502, { error: "Waitlist request failed" });
};
