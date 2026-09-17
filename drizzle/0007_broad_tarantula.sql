CREATE TABLE `customer_tags` (
	`customer_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`customer_id`, `tag_id`),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tag` text NOT NULL,
	`color` text DEFAULT '#6b7280',
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_tag_unique` ON `tags` (`tag`);