PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`travel_time` text NOT NULL,
	`recontact` integer DEFAULT 0 NOT NULL,
	`assigned_to` text DEFAULT '0vd84cJDrYloFlFJRdErhuztO9J9jwaI' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`assigned_to`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "name", "phone", "email", "travel_time", "recontact", "assigned_to", "created_at", "updated_at") SELECT "id", "name", "phone", "email", "travel_time", "recontact", "assigned_to", "created_at", "updated_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;