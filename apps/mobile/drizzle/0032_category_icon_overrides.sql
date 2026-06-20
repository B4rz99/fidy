CREATE TABLE `category_icon_overrides` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `category_id` text NOT NULL,
  `emoji` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_category_icon_overrides_user` ON `category_icon_overrides` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_category_icon_overrides_user_category` ON `category_icon_overrides` (`user_id`, `category_id`);
