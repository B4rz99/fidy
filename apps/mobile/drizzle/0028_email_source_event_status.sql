ALTER TABLE `processed_source_events` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `raw_body_preview` text;--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `raw_body` text;--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `retry_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `next_retry_at` text;--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `transaction_id` text;--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `confidence` real;--> statement-breakpoint
INSERT OR IGNORE INTO `processed_source_events` (
  `id`,
  `user_id`,
  `source_family`,
  `source_id`,
  `source_event_id`,
  `status`,
  `failure_reason`,
  `subject`,
  `raw_body_preview`,
  `raw_body`,
  `retry_count`,
  `next_retry_at`,
  `transaction_id`,
  `confidence`,
  `received_at`,
  `processed_at`,
  `created_at`,
  `updated_at`,
  `deleted_at`
)
SELECT
  'legacy-email-' || pe.`id`,
  (SELECT ea.`user_id` FROM `email_accounts` ea LIMIT 1),
  'email',
  CASE WHEN pe.`provider` = 'outlook' THEN 'email_outlook' ELSE 'email_gmail' END,
  pe.`external_id`,
  CASE WHEN pe.`status` = 'success' THEN 'processed' WHEN pe.`status` = 'skipped' THEN 'dismissed' ELSE pe.`status` END,
  pe.`failure_reason`,
  pe.`subject`,
  pe.`raw_body_preview`,
  pe.`raw_body`,
  pe.`retry_count`,
  pe.`next_retry_at`,
  pe.`transaction_id`,
  pe.`confidence`,
  pe.`received_at`,
  pe.`created_at`,
  pe.`created_at`,
  pe.`created_at`,
  NULL
FROM `processed_emails` pe
WHERE (SELECT COUNT(DISTINCT ea.`user_id`) FROM `email_accounts` ea) = 1;
--> statement-breakpoint
CREATE INDEX `idx_processed_source_events_retry_due` ON `processed_source_events` (`user_id`,`source_family`,`status`,`next_retry_at`);
