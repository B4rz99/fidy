DROP INDEX `uq_email_parse_improvement_sample`;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_email_parse_improvement_sample` ON `email_parse_improvement_samples` (`user_id`,`source`,`status`,`parse_method`,`provider_category`,`template`) WHERE `deleted_at` IS NULL;
