CREATE TABLE `quotation_school_include_schools` (
	`include_id` integer NOT NULL,
	`school_id` integer NOT NULL,
	PRIMARY KEY(`include_id`, `school_id`),
	FOREIGN KEY (`include_id`) REFERENCES `quotation_school_includes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`school_id`) REFERENCES `quotation_schools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quotation_school_includes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
