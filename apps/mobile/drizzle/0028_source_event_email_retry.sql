ALTER TABLE `processed_source_events` ADD `retry_raw_body` text;
--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `retry_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `next_retry_at` text;
--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `retry_transaction_id` text;
--> statement-breakpoint
ALTER TABLE `processed_source_events` ADD `retry_confidence` real;
--> statement-breakpoint
INSERT INTO `processed_source_events` (
  `id`,
  `user_id`,
  `source_family`,
  `source_id`,
  `source_event_id`,
  `status`,
  `failure_reason`,
  `received_at`,
  `processed_at`,
  `retry_raw_body`,
  `retry_count`,
  `next_retry_at`,
  `retry_transaction_id`,
  `retry_confidence`,
  `created_at`,
  `updated_at`,
  `deleted_at`
)
SELECT
  'pse_legacy_retry_' || `pe`.`id`,
  `owner`.`user_id`,
  'email',
  CASE
    WHEN `pe`.`provider` = 'gmail' THEN 'email_gmail'
    WHEN `pe`.`provider` = 'outlook' THEN 'email_outlook'
    ELSE `pe`.`provider`
  END,
  `pe`.`external_id`,
  'pending_retry',
  `pe`.`failure_reason`,
  `pe`.`received_at`,
  `pe`.`created_at`,
  CASE WHEN `owner`.`owner_count` = 1 THEN substr(`pe`.`raw_body`, 1, 5000) ELSE NULL END,
  `pe`.`retry_count`,
  `pe`.`next_retry_at`,
  NULL,
  NULL,
  `pe`.`created_at`,
  `pe`.`created_at`,
  NULL
FROM `processed_emails` `pe`
JOIN (
  SELECT
    `provider`,
    min(`user_id`) AS `user_id`,
    count(DISTINCT `user_id`) AS `owner_count`
  FROM `email_accounts`
  GROUP BY `provider`
) `owner` ON `owner`.`provider` = `pe`.`provider`
WHERE `pe`.`status` = 'pending_retry'
  AND `pe`.`next_retry_at` IS NOT NULL
  AND `owner`.`owner_count` = 1
  AND NOT EXISTS (
    SELECT 1
    FROM `processed_source_events` `pse`
    WHERE `pse`.`source_family` = 'email'
      AND `pse`.`source_event_id` = `pe`.`external_id`
      AND `pse`.`deleted_at` IS NULL
  );
--> statement-breakpoint
CREATE INDEX `idx_processed_source_events_retry_due` ON `processed_source_events` (`source_family`,`status`,`next_retry_at`);
