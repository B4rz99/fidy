UPDATE `email_accounts`
SET `email` = lower(`email`);--> statement-breakpoint
DELETE FROM `email_accounts`
WHERE `id` NOT IN (
	SELECT min(`id`)
	FROM `email_accounts`
	GROUP BY `user_id`, `email`
);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_email_accounts_user_email` ON `email_accounts` (`user_id`,`email`);
