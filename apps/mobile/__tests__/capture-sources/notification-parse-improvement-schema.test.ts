import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260502143000_notification_parse_improvement_samples.sql"
);
const EMAIL_SOURCES_MIGRATION = resolve(
  __dirname,
  "../../supabase/migrations/20260503153000_parse_improvement_email_sources.sql"
);

describe("notification parse improvement remote schema", () => {
  it("stores anonymized templates with insert-only RLS and review indexing", () => {
    const sql = readFileSync(MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain(
      "create table if not exists public.notification_parse_improvement_samples"
    );
    expect(sql).toContain("user_id uuid not null references auth.users(id) on delete cascade");
    expect(sql).toContain("template text not null");
    expect(sql).toContain("template_hash text not null");
    expect(sql).toContain(
      "source text not null check (source in ('notification_android', 'google_pay', 'email_gmail', 'email_outlook'))"
    );
    expect(sql).toContain("review_status text not null default 'pending'");
    expect(sql).toContain(
      "alter table public.notification_parse_improvement_samples enable row level security"
    );
    expect(sql).toContain(
      "alter table public.notification_parse_improvement_samples force row level security"
    );
    expect(sql).toContain("for insert to authenticated");
    expect(sql).toContain("with check ((select auth.uid()) = user_id)");
    expect(sql).toContain("idx_notification_parse_samples_review_status");
    expect(sql).toContain("status text not null check (status in ('failed', 'needs_review'))");
    expect(sql).not.toContain("for select to authenticated");
    expect(sql).not.toMatch(/raw_text|raw_body|merchant_name|amount_value/u);
  });

  it("updates already-applied source constraints to accept email samples", () => {
    const sql = readFileSync(EMAIL_SOURCES_MIGRATION, "utf8").toLowerCase();

    expect(sql).toContain(
      "drop constraint if exists notification_parse_improvement_samples_source_check"
    );
    expect(sql).toContain(
      "check (source in ('notification_android', 'google_pay', 'email_gmail', 'email_outlook'))"
    );
  });
});
