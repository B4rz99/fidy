CREATE TABLE public.waitlist_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Anon can only INSERT (landing page has no auth)
CREATE POLICY "anon_insert_only"
  ON public.waitlist_emails
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users (you) can read all emails
CREATE POLICY "authenticated_read"
  ON public.waitlist_emails
  FOR SELECT
  TO authenticated
  USING (true);
