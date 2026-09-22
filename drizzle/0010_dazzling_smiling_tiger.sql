CREATE TABLE `quotation_accommodations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'Residencia estudiantil' NOT NULL,
	`description` text,
	`price_per_week_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`min_weeks` real,
	`max_weeks` real,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `quotation_courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer,
	`school_id` integer,
	`name` text NOT NULL,
	`description` text,
	`weeks` real DEFAULT 1 NOT NULL,
	`schedule_id` integer,
	`hours_per_week` real DEFAULT 15 NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`program_id`) REFERENCES `quotation_programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_id`) REFERENCES `quotation_schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`schedule_id`) REFERENCES `quotation_schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_discounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'fixed' NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `quotation_extras` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`price_type` text DEFAULT 'fixed' NOT NULL,
	`application` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `quotation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quotation_id` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`quantity` real,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`source_type` text,
	`source_id` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quotation_programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`includes` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `quotation_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `quotation_schools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`logo` text,
	`website` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `quotation_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_name` text DEFAULT 'S Travel Costa Rica' NOT NULL,
	`logo` text,
	`phone` text,
	`whatsapp` text,
	`email` text,
	`website` text,
	`facebook` text,
	`instagram` text,
	`address` text,
	`terms` text,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`customer_id` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`issue_date` integer,
	`valid_until` integer,
	`advisor_id` text,
	`advisor_name` text,
	`advisor_email` text,
	`client_name` text NOT NULL,
	`client_phone` text,
	`client_email` text,
	`client_country` text,
	`program_id` integer,
	`program_name` text,
	`course_id` integer,
	`school_id` integer,
	`school_name` text,
	`course_name` text,
	`schedule_name` text,
	`weeks` real,
	`hours_per_week` real,
	`course_price_cents` integer,
	`accommodation_included` integer DEFAULT false NOT NULL,
	`accommodation_id` integer,
	`accommodation_name` text,
	`accommodation_type` text,
	`accommodation_weeks` real,
	`accommodation_price_per_week_cents` integer,
	`course_total_cents` integer DEFAULT 0 NOT NULL,
	`accommodation_total_cents` integer DEFAULT 0 NOT NULL,
	`extras_total_cents` integer DEFAULT 0 NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`discount_total_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`data` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`advisor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_number_unique` ON `quotations` (`number`);