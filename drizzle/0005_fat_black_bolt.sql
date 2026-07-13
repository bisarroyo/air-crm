CREATE TABLE `referrals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_code_unique` ON `referrals` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_code_uidx` ON `referrals` (`code`);--> statement-breakpoint
ALTER TABLE `customers` ADD `referral_id` integer REFERENCES referrals(id);