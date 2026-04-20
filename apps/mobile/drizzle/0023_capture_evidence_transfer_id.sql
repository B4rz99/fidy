ALTER TABLE `capture_evidence` ADD `transfer_id` text;
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_transfer` ON `capture_evidence` (`transfer_id`);
