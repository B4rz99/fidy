DROP INDEX IF EXISTS `uq_capture_evidence_email`;
--> statement-breakpoint
DROP INDEX IF EXISTS `uq_capture_evidence_capture`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_capture_evidence_processed_email`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_capture_evidence_processed_capture`;
--> statement-breakpoint
DROP INDEX IF EXISTS `uq_processed_external_id`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_processed_status`;
--> statement-breakpoint
DROP INDEX IF EXISTS `uq_capture_fingerprint`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_capture_source`;
--> statement-breakpoint
DROP TABLE IF EXISTS `processed_emails`;
--> statement-breakpoint
DROP TABLE IF EXISTS `processed_captures`;
--> statement-breakpoint
CREATE TABLE `capture_evidence_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_family` text NOT NULL,
	`evidence_type` text NOT NULL,
	`scope` text NOT NULL,
	`value` text NOT NULL,
	`transaction_id` text,
	`transfer_id` text,
	`processed_source_event_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT "ck_capture_evidence_financial_link" CHECK(`transaction_id` is null or `transfer_id` is null)
);
--> statement-breakpoint
INSERT INTO `capture_evidence_new` (
	`id`,
	`user_id`,
	`source_family`,
	`evidence_type`,
	`scope`,
	`value`,
	`transaction_id`,
	`transfer_id`,
	`processed_source_event_id`,
	`created_at`,
	`updated_at`,
	`deleted_at`
)
SELECT
	`id`,
	`user_id`,
	`source_family`,
	`evidence_type`,
	`scope`,
	`value`,
	`transaction_id`,
	`transfer_id`,
	`processed_source_event_id`,
	`created_at`,
	`updated_at`,
	`deleted_at`
FROM `capture_evidence`
WHERE `processed_source_event_id` IS NOT NULL;
--> statement-breakpoint
DROP TABLE `capture_evidence`;
--> statement-breakpoint
ALTER TABLE `capture_evidence_new` RENAME TO `capture_evidence`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capture_evidence_source_event` ON `capture_evidence` (`user_id`,`processed_source_event_id`,`scope`,`value`) WHERE `processed_source_event_id` IS NOT NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_user_scope_value` ON `capture_evidence` (`user_id`,`scope`,`value`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_transaction` ON `capture_evidence` (`transaction_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_transfer` ON `capture_evidence` (`transfer_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_processed_source_event` ON `capture_evidence` (`processed_source_event_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_user_updated` ON `capture_evidence` (`user_id`,`updated_at`);
