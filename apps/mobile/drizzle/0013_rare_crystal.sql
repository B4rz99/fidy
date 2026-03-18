CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`month` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_budget_user_category_month` ON `budgets` (`user_id`,`category_id`,`month`);--> statement-breakpoint
CREATE INDEX `idx_budgets_user_month` ON `budgets` (`user_id`,`month`);