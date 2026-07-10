CREATE TABLE `priority` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`priority` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `priority_priority_unique` ON `priority` (`priority`);--> statement-breakpoint
CREATE TABLE `status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `status_status_unique` ON `status` (`status`);--> statement-breakpoint
ALTER TABLE `customers` ADD `status_id` integer DEFAULT 1 NOT NULL REFERENCES status(id);--> statement-breakpoint
ALTER TABLE `customers` ADD `priority_id` integer DEFAULT 1 NOT NULL REFERENCES priority(id);--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `recontact`;