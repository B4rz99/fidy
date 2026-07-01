ALTER TABLE `financial_accounts` ADD `source` text DEFAULT 'local_ledger' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_categories` ADD `source` text DEFAULT 'local_ledger' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_financial_accounts_user_source` ON `financial_accounts` (`user_id`, `source`);
--> statement-breakpoint
CREATE INDEX `idx_user_categories_user_source` ON `user_categories` (`user_id`, `source`);
