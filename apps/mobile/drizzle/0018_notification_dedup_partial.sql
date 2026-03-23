DROP INDEX IF EXISTS `uq_notification_dedup`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_notification_dedup` ON `notifications` (`user_id`, `dedup_key`) WHERE `deleted_at` IS NULL;