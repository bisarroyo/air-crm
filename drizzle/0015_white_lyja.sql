CREATE TABLE `email_campaign_recipients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`customer_id` integer,
	`name` text NOT NULL,
	`email` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`sent_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `email_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_recipients_campaign_uidx` ON `email_campaign_recipients` (`campaign_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `email_recipients_campaign_status_idx` ON `email_campaign_recipients` (`campaign_id`,`status`);--> statement-breakpoint
CREATE TABLE `email_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body_html` text NOT NULL,
	`mode` text DEFAULT 'visual' NOT NULL,
	`bcc` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`recipient_count` integer DEFAULT 0 NOT NULL,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX "email_recipients_campaign_uidx";--> statement-breakpoint
DROP INDEX "email_recipients_campaign_status_idx";--> statement-breakpoint
DROP INDEX "priority_priority_unique";--> statement-breakpoint
DROP INDEX "quotations_number_unique";--> statement-breakpoint
DROP INDEX "referrals_code_unique";--> statement-breakpoint
DROP INDEX "referrals_code_uidx";--> statement-breakpoint
DROP INDEX "status_status_unique";--> statement-breakpoint
DROP INDEX "tags_tag_unique";--> statement-breakpoint
DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "invitation_organizationId_idx";--> statement-breakpoint
DROP INDEX "invitation_email_idx";--> statement-breakpoint
DROP INDEX "member_organizationId_idx";--> statement-breakpoint
DROP INDEX "member_userId_idx";--> statement-breakpoint
DROP INDEX "organization_slug_unique";--> statement-breakpoint
DROP INDEX "organization_slug_uidx";--> statement-breakpoint
DROP INDEX "passkey_userId_idx";--> statement-breakpoint
DROP INDEX "passkey_credentialID_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "twoFactor_secret_idx";--> statement-breakpoint
DROP INDEX "twoFactor_userId_idx";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE `customers` ALTER COLUMN "status_changed_at" TO "status_changed_at" integer;--> statement-breakpoint
CREATE UNIQUE INDEX `priority_priority_unique` ON `priority` (`priority`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotations_number_unique` ON `quotations` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_code_unique` ON `referrals` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_code_uidx` ON `referrals` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `status_status_unique` ON `status` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_tag_unique` ON `tags` (`tag`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_uidx` ON `organization` (`slug`);--> statement-breakpoint
CREATE INDEX `passkey_userId_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credentialID_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `twoFactor_secret_idx` ON `two_factor` (`secret`);--> statement-breakpoint
CREATE INDEX `twoFactor_userId_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);