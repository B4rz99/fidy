CREATE TABLE `merchant_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sender_email` text NOT NULL,
	`keyword` text NOT NULL,
	`category_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_merchant_rule` ON `merchant_rules` (`user_id`,`sender_email`,`keyword`);--> statement-breakpoint
CREATE INDEX `idx_merchant_lookup` ON `merchant_rules` (`user_id`,`sender_email`);--> statement-breakpoint
ALTER TABLE `processed_emails` ADD `confidence` real;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_processed_external_id` ON `processed_emails` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_processed_status` ON `processed_emails` (`status`);--> statement-breakpoint
CREATE INDEX `idx_email_accounts_user` ON `email_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category` ON `transactions` (`user_id`,`category_id`);