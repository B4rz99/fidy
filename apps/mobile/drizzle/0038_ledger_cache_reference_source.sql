ALTER TABLE `financial_accounts` ADD `source` text DEFAULT 'local_ledger' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_categories` ADD `source` text DEFAULT 'local_ledger' NOT NULL;
--> statement-breakpoint
UPDATE `financial_accounts`
SET `source` = 'cloud_ledger'
WHERE EXISTS (
  SELECT 1
  FROM `transactions`
  WHERE `transactions`.`user_id` = `financial_accounts`.`user_id`
    AND `transactions`.`account_id` = `financial_accounts`.`id`
    AND `transactions`.`source` = 'cloud_ledger'
)
AND NOT EXISTS (
  SELECT 1
  FROM `transactions`
  WHERE `transactions`.`user_id` = `financial_accounts`.`user_id`
    AND `transactions`.`account_id` = `financial_accounts`.`id`
    AND `transactions`.`source` <> 'cloud_ledger'
)
AND NOT EXISTS (
  SELECT 1
  FROM `transfers`
  WHERE `transfers`.`user_id` = `financial_accounts`.`user_id`
    AND (
      `transfers`.`from_account_id` = `financial_accounts`.`id`
      OR `transfers`.`to_account_id` = `financial_accounts`.`id`
    )
)
AND NOT EXISTS (
  SELECT 1
  FROM `opening_balances`
  WHERE `opening_balances`.`user_id` = `financial_accounts`.`user_id`
    AND `opening_balances`.`account_id` = `financial_accounts`.`id`
    AND `opening_balances`.`deleted_at` IS NULL
)
AND NOT EXISTS (
  SELECT 1
  FROM `financial_account_identifiers`
  WHERE `financial_account_identifiers`.`user_id` = `financial_accounts`.`user_id`
    AND `financial_account_identifiers`.`account_id` = `financial_accounts`.`id`
    AND `financial_account_identifiers`.`deleted_at` IS NULL
);
--> statement-breakpoint
UPDATE `user_categories`
SET `source` = 'cloud_ledger'
WHERE EXISTS (
  SELECT 1
  FROM `transactions`
  WHERE `transactions`.`user_id` = `user_categories`.`user_id`
    AND `transactions`.`category_id` = `user_categories`.`id`
    AND `transactions`.`source` = 'cloud_ledger'
)
AND NOT EXISTS (
  SELECT 1
  FROM `transactions`
  WHERE `transactions`.`user_id` = `user_categories`.`user_id`
    AND `transactions`.`category_id` = `user_categories`.`id`
    AND `transactions`.`source` <> 'cloud_ledger'
)
AND NOT EXISTS (
  SELECT 1
  FROM `category_icon_overrides`
  WHERE `category_icon_overrides`.`user_id` = `user_categories`.`user_id`
    AND `category_icon_overrides`.`category_id` = `user_categories`.`id`
    AND `category_icon_overrides`.`deleted_at` IS NULL
)
AND NOT EXISTS (
  SELECT 1
  FROM `category_color_overrides`
  WHERE `category_color_overrides`.`user_id` = `user_categories`.`user_id`
    AND `category_color_overrides`.`category_id` = `user_categories`.`id`
    AND `category_color_overrides`.`deleted_at` IS NULL
)
AND NOT EXISTS (
  SELECT 1
  FROM `budgets`
  WHERE `budgets`.`user_id` = `user_categories`.`user_id`
    AND `budgets`.`category_id` = `user_categories`.`id`
    AND `budgets`.`deleted_at` IS NULL
)
AND NOT EXISTS (
  SELECT 1
  FROM `bills`
  WHERE `bills`.`user_id` = `user_categories`.`user_id`
    AND `bills`.`category_id` = `user_categories`.`id`
)
AND NOT EXISTS (
  SELECT 1
  FROM `review_candidates`
  WHERE `review_candidates`.`user_id` = `user_categories`.`user_id`
    AND `review_candidates`.`category_id` = `user_categories`.`id`
    AND `review_candidates`.`deleted_at` IS NULL
)
AND NOT EXISTS (
  SELECT 1
  FROM `merchant_rules`
  WHERE `merchant_rules`.`user_id` = `user_categories`.`user_id`
    AND `merchant_rules`.`category_id` = `user_categories`.`id`
)
AND NOT EXISTS (
  SELECT 1
  FROM `notifications`
  WHERE `notifications`.`user_id` = `user_categories`.`user_id`
    AND `notifications`.`category_id` = `user_categories`.`id`
    AND `notifications`.`deleted_at` IS NULL
);
--> statement-breakpoint
CREATE INDEX `idx_financial_accounts_user_source` ON `financial_accounts` (`user_id`, `source`);
--> statement-breakpoint
CREATE INDEX `idx_user_categories_user_source` ON `user_categories` (`user_id`, `source`);
