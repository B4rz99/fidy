CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`dedup_key` text NOT NULL,
	`category_id` text,
	`goal_id` text,
	`title_key` text NOT NULL,
	`message_key` text NOT NULL,
	`params` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_notification_dedup` ON `notifications` (`user_id`,`dedup_key`);