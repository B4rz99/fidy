CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`action` text,
	`action_status` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session_created` ON `chat_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_user_created` ON `chat_sessions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_expires` ON `chat_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `user_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fact` text NOT NULL,
	`category` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_user_memories_user` ON `user_memories` (`user_id`);