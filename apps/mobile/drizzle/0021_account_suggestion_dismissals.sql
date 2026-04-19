CREATE TABLE `account_suggestion_dismissals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope` text NOT NULL,
	`value` text NOT NULL,
	`dismissed_score` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_account_suggestion_dismissals_scope` ON `account_suggestion_dismissals` (`user_id`,`scope`,`value`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_account_suggestion_dismissals_user_updated` ON `account_suggestion_dismissals` (`user_id`,`updated_at`);
