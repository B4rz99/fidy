CREATE TABLE `bill_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bill_payments_bill` ON `bill_payments` (`bill_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_bill_payment_occurrence` ON `bill_payments` (`bill_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`frequency` text NOT NULL,
	`category_id` text NOT NULL,
	`start_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bills_user` ON `bills` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_bills_user_active` ON `bills` (`user_id`,`is_active`);