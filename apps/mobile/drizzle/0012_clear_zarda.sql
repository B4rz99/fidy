ALTER TABLE `processed_emails` ADD `raw_body` text;--> statement-breakpoint
ALTER TABLE `processed_emails` ADD `retry_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `processed_emails` ADD `next_retry_at` text;