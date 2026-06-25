CREATE TABLE `capture_improvement_deletion_requests` (
  `user_id` text PRIMARY KEY NOT NULL,
  `requested_at` text NOT NULL,
  `last_attempt_at` text
);
