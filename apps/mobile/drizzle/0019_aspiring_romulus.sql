CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`system_key` text,
	`account_class` text NOT NULL,
	`account_subtype` text NOT NULL,
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`last4` text,
	`baseline_amount` integer NOT NULL,
	`baseline_date` text NOT NULL,
	`credit_limit` integer,
	`closing_day` integer,
	`due_day` integer,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_user_active` ON `accounts` (`user_id`,`archived_at`);--> statement-breakpoint
CREATE INDEX `idx_accounts_user_subtype` ON `accounts` (`user_id`,`account_subtype`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_accounts_user_system_key` ON `accounts` (`user_id`,`system_key`);