ALTER TABLE `transactions` RENAME COLUMN `amount_cents` TO `amount`;--> statement-breakpoint
ALTER TABLE `bills` RENAME COLUMN `amount_cents` TO `amount`;--> statement-breakpoint
ALTER TABLE `budgets` RENAME COLUMN `amount_cents` TO `amount`;
