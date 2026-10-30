CREATE TABLE `travel_lead_tags` (
	`lead_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`lead_id`, `tag_id`),
	FOREIGN KEY (`lead_id`) REFERENCES `travel_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `travel_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `travel_lead_tags_tag_idx` ON `travel_lead_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `travel_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag` text NOT NULL,
	`color` text DEFAULT '#6b7280',
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `travel_tags_tag_unique` ON `travel_tags` (`tag`);--> statement-breakpoint
ALTER TABLE `travel_leads` ADD `travel_date_from` text;--> statement-breakpoint
ALTER TABLE `travel_leads` ADD `travel_date_to` text;