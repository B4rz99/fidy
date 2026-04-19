CREATE TABLE `financial_account_identifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`scope` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_financial_account_identifier` ON `financial_account_identifiers` (`user_id`,`account_id`,`scope`,`value`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_financial_account_identifiers_account` ON `financial_account_identifiers` (`account_id`);--> statement-breakpoint
CREATE TABLE `financial_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_financial_accounts_user` ON `financial_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_financial_accounts_user_default` ON `financial_accounts` (`user_id`,`is_default`);--> statement-breakpoint
CREATE TABLE `opening_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`effective_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_opening_balances_account` ON `opening_balances` (`account_id`) WHERE `deleted_at` IS NULL;--> statement-breakpoint
CREATE INDEX `idx_opening_balances_user` ON `opening_balances` (`user_id`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`from_account_id` text,
	`to_account_id` text,
	`from_external_label` text,
	`to_external_label` text,
	`description` text,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	CONSTRAINT `ck_transfers_from_endpoint` CHECK(`from_account_id` IS NOT NULL OR NULLIF(TRIM(`from_external_label`), '') IS NOT NULL),
	CONSTRAINT `ck_transfers_to_endpoint` CHECK(`to_account_id` IS NOT NULL OR NULLIF(TRIM(`to_external_label`), '') IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_transfers_user_date` ON `transfers` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transfers_user_updated` ON `transfers` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` text NOT NULL,
	`description` text,
	`date` text NOT NULL,
	`account_id` text NOT NULL,
	`account_attribution_state` text NOT NULL,
	`superseded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`source` text DEFAULT 'manual' NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_transactions` (
	`id`,
	`user_id`,
	`type`,
	`amount`,
	`category_id`,
	`description`,
	`date`,
	`account_id`,
	`account_attribution_state`,
	`superseded_at`,
	`created_at`,
	`updated_at`,
	`deleted_at`,
	`source`
)
SELECT
	`id`,
	`user_id`,
	`type`,
	`amount`,
	`category_id`,
	`description`,
	`date`,
	'fa-default-' || `user_id`,
	CASE
		WHEN `source` = 'manual' THEN 'confirmed'
		ELSE 'unresolved'
	END,
	NULL,
	`created_at`,
	`updated_at`,
	`deleted_at`,
	`source`
FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_category` ON `transactions` (`user_id`,`category_id`);
