CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `user_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `updated_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `deleted_at` text;