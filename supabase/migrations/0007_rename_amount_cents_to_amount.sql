-- Rename column from centavos to direct pesos
ALTER TABLE public.transactions RENAME COLUMN amount_cents TO amount;

-- Convert existing centavo values to pesos
UPDATE public.transactions SET amount = amount / 100;

-- Recreate get_user_balance function with new column name
CREATE OR REPLACE FUNCTION public.get_user_balance()
RETURNS bigint
LANGUAGE sql
SECURITY definer
SET search_path = ''
AS $$
  select coalesce(
    sum(case when type = 'income' then amount else -amount end),
    0
  )::bigint
  from public.transactions
  where user_id = auth.uid() and deleted_at is null;
$$;
