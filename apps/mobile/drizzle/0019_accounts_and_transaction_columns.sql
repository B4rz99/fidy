CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`bank_key` text NOT NULL,
	`identifiers` text DEFAULT '[]' NOT NULL,
	`initial_balance` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_bank` ON `accounts` (`user_id`,`bank_key`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `account_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `linked_transaction_id` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `needs_account_review` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_transactions_account` ON `transactions` (`account_id`);