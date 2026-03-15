CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`local_data` text NOT NULL,
	`server_data` text NOT NULL,
	`detected_at` text NOT NULL,
	`resolved_at` text,
	`resolution` text
);
--> statement-breakpoint
CREATE INDEX `idx_sync_conflicts_resolved` ON `sync_conflicts` (`resolved_at`);