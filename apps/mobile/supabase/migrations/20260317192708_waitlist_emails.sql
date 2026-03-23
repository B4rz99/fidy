CREATE TABLE public.waitlist_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness so User@Example.com = user@example.com
CREATE UNIQUE INDEX waitlist_emails_email_unique ON public.waitlist_emails (lower(email));

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Anon can only INSERT (landing page has no auth)
-- Reading is done via Supabase dashboard (service_role bypasses RLS)
CREATE POLICY "anon_insert_only"
  ON public.waitlist_emails
  FOR INSERT
  TO anon
  WITH CHECK (true);
