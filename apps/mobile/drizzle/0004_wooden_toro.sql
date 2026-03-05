CREATE TABLE `processed_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`failure_reason` text,
	`subject` text NOT NULL,
	`raw_body_preview` text,
	`received_at` text NOT NULL,
	`transaction_id` text,
	`created_at` text NOT NULL
);
