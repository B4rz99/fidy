CREATE TABLE `email_parse_improvement_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template` text NOT NULL,
	`sender_domain` text,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`confidence` real,
	`parse_method` text NOT NULL,
	`created_at` text NOT NULL,
	`shared_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_email_parse_improvement_sample` ON `email_parse_improvement_samples` (`user_id`,`source`,`status`,`parse_method`,coalesce(`sender_domain`,''),`template`);
--> statement-breakpoint
CREATE INDEX `idx_email_parse_improvement_samples_pending` ON `email_parse_improvement_samples` (`user_id`,`shared_at`,`deleted_at`,`created_at`,`id`);
