ALTER TABLE `customers` ADD `status_changed_at` integer;
--> statement-breakpoint
UPDATE `customers` SET `status_changed_at` = COALESCE(`created_at`, CAST(strftime('%s', 'now') AS INTEGER));