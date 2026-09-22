CREATE TABLE `customer_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`type` text DEFAULT 'charla' NOT NULL,
	`title` text,
	`scheduled_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`meeting_link` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
