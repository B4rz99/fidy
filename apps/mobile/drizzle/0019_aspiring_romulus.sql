CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`system_key` text,
	`account_class` text NOT NULL CHECK(`account_class` in ('asset', 'liability')),
	`account_subtype` text NOT NULL CHECK(`account_subtype` in ('checking', 'savings', 'cash', 'digital_holding', 'credit_card', 'loan', 'investment', 'other')),
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`last4` text CHECK(`last4` IS NULL OR `last4` GLOB '[0-9][0-9][0-9][0-9]'),
	`baseline_amount` integer NOT NULL,
	`baseline_date` text NOT NULL,
	`credit_limit` integer CHECK(`credit_limit` IS NULL OR `credit_limit` >= 0),
	`closing_day` integer CHECK(`closing_day` IS NULL OR (`closing_day` BETWEEN 1 AND 31)),
	`due_day` integer CHECK(`due_day` IS NULL OR (`due_day` BETWEEN 1 AND 31)),
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user_active` ON `accounts` (`user_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_subtype` ON `accounts` (`user_id`,`account_subtype`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_accounts_user_system_key` ON `accounts` (`user_id`,`system_key`);
