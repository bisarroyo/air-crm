CREATE TABLE `quotation_email_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` integer NOT NULL,
	`sent_by` text NOT NULL,
	`recipients` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sent_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quotation_email_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`copy_company` integer DEFAULT true NOT NULL,
	`default_template_id` text,
	`templates` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
