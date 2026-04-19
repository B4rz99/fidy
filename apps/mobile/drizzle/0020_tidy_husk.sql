CREATE TABLE `capture_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_family` text NOT NULL,
	`evidence_type` text NOT NULL,
	`scope` text NOT NULL,
	`value` text NOT NULL,
	`transaction_id` text,
	`processed_email_id` text,
	`processed_capture_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT `ck_capture_evidence_source_record` CHECK((CASE WHEN `processed_email_id` IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN `processed_capture_id` IS NOT NULL THEN 1 ELSE 0 END) = 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capture_evidence_email` ON `capture_evidence` (`user_id`,`processed_email_id`,`scope`,`value`) WHERE `processed_email_id` IS NOT NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_capture_evidence_capture` ON `capture_evidence` (`user_id`,`processed_capture_id`,`scope`,`value`) WHERE `processed_capture_id` IS NOT NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_user_scope_value` ON `capture_evidence` (`user_id`,`scope`,`value`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_transaction` ON `capture_evidence` (`transaction_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_processed_email` ON `capture_evidence` (`processed_email_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_processed_capture` ON `capture_evidence` (`processed_capture_id`);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_user_updated` ON `capture_evidence` (`user_id`,`updated_at`);
