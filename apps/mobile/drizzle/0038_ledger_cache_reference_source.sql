ALTER TABLE `financial_accounts` ADD `source` text DEFAULT 'local_ledger' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_categories` ADD `source` text DEFAULT 'local_ledger' NOT NULL;
--> statement-breakpoint
UPDATE `financial_accounts`
SET `source` = 'cloud_ledger'
;
--> statement-breakpoint
UPDATE `user_categories`
SET `source` = 'cloud_ledger'
;
--> statement-breakpoint
UPDATE `financial_accounts`
SET `source` = 'local_ledger'
WHERE `id` IN (
  SELECT `account_id`
  FROM `transactions`
  WHERE `source` <> 'cloud_ledger'
)
OR `id` IN (
  SELECT `from_account_id`
  FROM `transfers`
  WHERE `from_account_id` IS NOT NULL
    AND `source` <> 'cloud_ledger'
)
OR `id` IN (
  SELECT `to_account_id`
  FROM `transfers`
  WHERE `to_account_id` IS NOT NULL
    AND `source` <> 'cloud_ledger'
)
OR `id` IN (
  SELECT `account_id`
  FROM `opening_balances`
)
OR `id` IN (
  SELECT `account_id`
  FROM `financial_account_identifiers`
)
OR `id` = 'fa-default-' || `user_id`
OR `is_default` = 1;
--> statement-breakpoint
UPDATE `user_categories`
SET `source` = 'local_ledger'
WHERE `id` IN (
  SELECT `category_id`
  FROM `transactions`
  WHERE `source` <> 'cloud_ledger'
)
OR `id` IN (
  SELECT `category_id`
  FROM `budgets`
)
OR `id` IN (
  SELECT `category_id`
  FROM `category_icon_overrides`
)
OR `id` IN (
  SELECT `category_id`
  FROM `category_color_overrides`
)
OR `id` IN (
  SELECT `category_id`
  FROM `bills`
)
OR `id` IN (
  SELECT `category_id`
  FROM `review_candidates`
  WHERE `category_id` IS NOT NULL
)
OR `id` IN (
  SELECT `category_id`
  FROM `merchant_rules`
)
OR `id` IN (
  SELECT `category_id`
  FROM `notifications`
  WHERE `category_id` IS NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_financial_accounts_user_source` ON `financial_accounts` (`user_id`, `source`);
--> statement-breakpoint
CREATE INDEX `idx_user_categories_user_source` ON `user_categories` (`user_id`, `source`);
