CREATE TABLE `customer_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`note` text NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customer_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_date` integer,
	`urgency` text DEFAULT 'medium' NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
