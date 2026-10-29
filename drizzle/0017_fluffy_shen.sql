CREATE TABLE `travel_lead_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`type` text DEFAULT 'charla' NOT NULL,
	`title` text,
	`scheduled_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`meeting_link` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`lead_id`) REFERENCES `travel_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `travel_lead_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`note` text NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`lead_id`) REFERENCES `travel_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `travel_leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`meta_inbox_url` text,
	`status_id` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`status_changed_at` integer,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`status_id`) REFERENCES `travel_statuses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `travel_statuses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`color` text DEFAULT '#6b7280',
	`is_active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `travel_statuses_status_unique` ON `travel_statuses` (`status`);--> statement-breakpoint
INSERT INTO `travel_statuses` (`status`, `color`) VALUES
	('Nuevo', '#6b7280'),
	('Contactado', '#3b82f6'),
	('Cotizado', '#f59e0b'),
	('Ganado', '#10b981'),
	('Perdido', '#ef4444');