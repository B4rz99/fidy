ALTER TABLE `transactions` ADD `user_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `updated_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `deleted_at` text;
