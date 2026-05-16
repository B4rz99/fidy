CREATE TABLE `processed_source_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_family` text NOT NULL,
	`source_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`status` text NOT NULL,
	`failure_reason` text,
	`received_at` text NOT NULL,
	`processed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_processed_source_event` ON `processed_source_events` (`user_id`,`source_family`,`source_id`,`source_event_id`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_processed_source_events_user_status` ON `processed_source_events` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_processed_source_events_user_updated` ON `processed_source_events` (`user_id`,`updated_at`);
--> statement-breakpoint
DROP INDEX `uq_capture_evidence_email`;
--> statement-breakpoint
DROP INDEX `uq_capture_evidence_capture`;
--> statement-breakpoint
DROP INDEX `idx_capture_evidence_user_scope_value`;
--> statement-breakpoint
DROP INDEX `idx_capture_evidence_transaction`;
--> statement-breakpoint
DROP INDEX `idx_capture_evidence_transfer`;
--> statement-breakpoint
DROP INDEX `idx_capture_evidence_processed_email`;
--> statement-breakpoint
DROP INDEX `idx_capture_evidence_processed_capture`;
--> statement-breakpoint
DROP INDEX `idx_capture_evidence_user_updated`;
--> statement-breakpoint
ALTER TABLE `capture_evidence` RENAME TO `capture_evidence_old`;
--> statement-breakpoint
CREATE TABLE `capture_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_family` text NOT NULL,
	`evidence_type` text NOT NULL,
	`scope` text NOT NULL,
	`value` text NOT NULL,
	`transaction_id` text,
	`transfer_id` text,
	`processed_email_id` text,
	`processed_capture_id` text,
	`processed_source_event_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT `ck_capture_evidence_source_record` CHECK((CASE WHEN `processed_email_id` IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN `processed_capture_id` IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN `processed_source_event_id` IS NOT NULL THEN 1 ELSE 0 END) = 1),
	CONSTRAINT `ck_capture_evidence_financial_link` CHECK(`transaction_id` IS NULL OR `transfer_id` IS NULL)
);
--> statement-breakpoint
INSERT INTO `capture_evidence` (
	`id`,
	`user_id`,
	`source_family`,
	`evidence_type`,
	`scope`,
	`value`,
	`transaction_id`,
	`transfer_id`,
	`processed_email_id`,
	`processed_capture_id`,
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
	`processed_email_id`,
	`processed_capture_id`,
	NULL,
	`created_at`,
	`updated_at`,
	`deleted_at`
FROM `capture_evidence_old`;
--> statement-breakpoint
DROP TABLE `capture_evidence_old`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capture_evidence_email` ON `capture_evidence` (`user_id`,`processed_email_id`,`scope`,`value`) WHERE `processed_email_id` IS NOT NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capture_evidence_capture` ON `capture_evidence` (`user_id`,`processed_capture_id`,`scope`,`value`) WHERE `processed_capture_id` IS NOT NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capture_evidence_source_event` ON `capture_evidence` (`user_id`,`processed_source_event_id`,`scope`,`value`) WHERE `processed_source_event_id` IS NOT NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_user_scope_value` ON `capture_evidence` (`user_id`,`scope`,`value`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_transaction` ON `capture_evidence` (`transaction_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_transfer` ON `capture_evidence` (`transfer_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_processed_email` ON `capture_evidence` (`processed_email_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_processed_capture` ON `capture_evidence` (`processed_capture_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_processed_source_event` ON `capture_evidence` (`processed_source_event_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_user_updated` ON `capture_evidence` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `review_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`processed_source_event_id` text NOT NULL,
	`status` text NOT NULL,
	`candidate_kind` text NOT NULL,
	`occurred_at` text,
	`amount` integer,
	`currency` text DEFAULT 'COP' NOT NULL,
	`transaction_type` text,
	`category_id` text,
	`description` text,
	`confidence` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_review_candidates_user_status` ON `review_candidates` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `idx_review_candidates_source_event` ON `review_candidates` (`processed_source_event_id`);
--> statement-breakpoint
CREATE INDEX `idx_review_candidates_user_updated` ON `review_candidates` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `review_candidate_capture_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`review_candidate_id` text NOT NULL,
	`capture_evidence_id` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_review_candidate_capture_evidence` ON `review_candidate_capture_evidence` (`user_id`,`review_candidate_id`,`capture_evidence_id`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_review_candidate_capture_evidence_user` ON `review_candidate_capture_evidence` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_review_candidate_capture_evidence_candidate` ON `review_candidate_capture_evidence` (`review_candidate_id`);
--> statement-breakpoint
CREATE INDEX `idx_review_candidate_capture_evidence_evidence` ON `review_candidate_capture_evidence` (`capture_evidence_id`);
