CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` text NOT NULL,
	`description` text,
	`counterparty_name` text,
	`date` text NOT NULL,
	`account_id` text NOT NULL,
	`account_attribution_state` text NOT NULL,
	`superseded_at` text,
	`superseded_by_transfer_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`voided_at` text,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_transactions` (
	`id`,
	`user_id`,
	`type`,
	`amount`,
	`category_id`,
	`description`,
	`counterparty_name`,
	`date`,
	`account_id`,
	`account_attribution_state`,
	`superseded_at`,
	`superseded_by_transfer_id`,
	`created_at`,
	`updated_at`,
	`voided_at`,
	`source`
)
SELECT
	`id`,
	`user_id`,
	`type`,
	`amount`,
	`category_id`,
	`description`,
	NULL,
	`date`,
	`account_id`,
	`account_attribution_state`,
	`superseded_at`,
	NULL,
	`created_at`,
	`updated_at`,
	`deleted_at`,
	CASE WHEN `source` IN ('manual', 'automated') THEN `source` ELSE 'automated' END
FROM `transactions`;
--> statement-breakpoint
DROP TABLE `transactions`;
--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;
--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);
--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category` ON `transactions` (`user_id`,`category_id`);
