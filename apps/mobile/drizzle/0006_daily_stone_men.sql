CREATE TABLE `detected_sms_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sender_label` text NOT NULL,
	`detected_at` text NOT NULL,
	`dismissed` integer DEFAULT false NOT NULL,
	`linked_transaction_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sms_events_user_dismissed` ON `detected_sms_events` (`user_id`,`dismissed`);--> statement-breakpoint
CREATE TABLE `notification_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`package_name` text NOT NULL,
	`label` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_notification_source` ON `notification_sources` (`user_id`,`package_name`);--> statement-breakpoint
CREATE TABLE `processed_captures` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint_hash` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`raw_text` text,
	`transaction_id` text,
	`confidence` real,
	`received_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capture_fingerprint` ON `processed_captures` (`fingerprint_hash`);--> statement-breakpoint
CREATE INDEX `idx_capture_source` ON `processed_captures` (`source`);