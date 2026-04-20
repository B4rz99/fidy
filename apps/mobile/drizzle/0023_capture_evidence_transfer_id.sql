ALTER TABLE `capture_evidence`
  ADD `transfer_id` text CHECK (`transaction_id` IS NULL OR `transfer_id` IS NULL);
--> statement-breakpoint
CREATE INDEX `idx_capture_evidence_transfer` ON `capture_evidence` (`transfer_id`);
