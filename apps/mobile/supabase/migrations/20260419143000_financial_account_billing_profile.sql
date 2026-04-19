alter table public.financial_accounts
  add column statement_closing_day integer,
  add column payment_due_day integer;

alter table public.financial_accounts
  add constraint ck_financial_accounts_statement_closing_day
  check (
    statement_closing_day is null
    or statement_closing_day between 1 and 31
  );

alter table public.financial_accounts
  add constraint ck_financial_accounts_payment_due_day
  check (
    payment_due_day is null
    or payment_due_day between 1 and 31
  );
