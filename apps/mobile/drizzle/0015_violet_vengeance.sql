CREATE TABLE `goal_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal` ON `goal_contributions` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_goal_date` ON `goal_contributions` (`goal_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_goal_contributions_user` ON `goal_contributions` (`user_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`target_amount` integer NOT NULL,
	`target_date` text,
	`interest_rate_percent` real,
	`icon_name` text,
	`color_hex` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_goals_user` ON `goals` (`user_id`);