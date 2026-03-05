CREATE TABLE `email_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`email` text NOT NULL,
	`last_fetched_at` text,
	`created_at` text NOT NULL
);
