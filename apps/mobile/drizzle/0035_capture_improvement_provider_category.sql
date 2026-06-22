ALTER TABLE `email_parse_improvement_samples` ADD COLUMN `provider_category` text NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
UPDATE `email_parse_improvement_samples`
SET `provider_category` = CASE
  WHEN lower(coalesce(`sender_domain`, '')) LIKE '%banco%'
    OR lower(coalesce(`sender_domain`, '')) LIKE '%bank%'
    OR lower(coalesce(`sender_domain`, '')) LIKE '%bbva%'
    OR lower(coalesce(`sender_domain`, '')) LIKE '%davibank%'
    OR lower(coalesce(`sender_domain`, '')) LIKE '%davivienda%'
    OR lower(coalesce(`sender_domain`, '')) LIKE '%nequi%'
    OR lower(coalesce(`sender_domain`, '')) LIKE '%bancolombia%'
  THEN 'bank'
  ELSE 'unknown'
END;
--> statement-breakpoint
DROP INDEX `uq_email_parse_improvement_sample`;
--> statement-breakpoint
DELETE FROM `email_parse_improvement_samples`
WHERE rowid NOT IN (
  SELECT min(rowid)
  FROM `email_parse_improvement_samples`
  GROUP BY `user_id`, `source`, `status`, `parse_method`, `provider_category`, `template`
);
--> statement-breakpoint
UPDATE `email_parse_improvement_samples` SET `sender_domain` = NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_email_parse_improvement_sample` ON `email_parse_improvement_samples` (`user_id`,`source`,`status`,`parse_method`,`provider_category`,`template`);
