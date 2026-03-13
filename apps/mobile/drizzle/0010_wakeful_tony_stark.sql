DROP INDEX IF EXISTS `uq_merchant_rule`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_merchant_lookup`;--> statement-breakpoint
DROP INDEX IF EXISTS `uq_merchant_rule_v2`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_merchant_lookup_v2`;--> statement-breakpoint
DROP TABLE IF EXISTS `merchant_rules_new`;--> statement-breakpoint
CREATE TABLE `merchant_rules_new` (`id` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `keyword` text NOT NULL, `category_id` text NOT NULL, `created_at` text NOT NULL);--> statement-breakpoint
INSERT INTO `merchant_rules_new` SELECT m.`id`, m.`user_id`, m.`keyword`, m.`category_id`, m.`created_at` FROM `merchant_rules` m INNER JOIN (SELECT MAX(`id`) AS `id` FROM `merchant_rules` GROUP BY `user_id`, `keyword`) winner ON m.`id` = winner.`id`;--> statement-breakpoint
DROP TABLE `merchant_rules`;--> statement-breakpoint
ALTER TABLE `merchant_rules_new` RENAME TO `merchant_rules`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_merchant_rule_v2` ON `merchant_rules` (`user_id`,`keyword`);--> statement-breakpoint
CREATE INDEX `idx_merchant_lookup_v2` ON `merchant_rules` (`user_id`);
