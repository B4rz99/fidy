ALTER TABLE `transactions` RENAME COLUMN `amount_cents` TO `amount`;--> statement-breakpoint
UPDATE `transactions` SET `amount` = ROUND(`amount` / 100);--> statement-breakpoint
ALTER TABLE `bills` RENAME COLUMN `amount_cents` TO `amount`;--> statement-breakpoint
UPDATE `bills` SET `amount` = ROUND(`amount` / 100);--> statement-breakpoint
ALTER TABLE `budgets` RENAME COLUMN `amount_cents` TO `amount`;--> statement-breakpoint
UPDATE `budgets` SET `amount` = ROUND(`amount` / 100);