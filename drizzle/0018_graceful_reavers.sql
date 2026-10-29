CREATE TABLE `google_sheets_integrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`web_app_url` text DEFAULT '' NOT NULL,
	`secret_encrypted` text,
	`max_attempts` integer DEFAULT 8 NOT NULL,
	`last_success_at` integer,
	`last_error` text,
	`last_tested_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_sheets_integrations_org_uidx` ON `google_sheets_integrations` (`organization_id`);--> statement-breakpoint
CREATE TABLE `google_sheets_sync_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` text NOT NULL,
	`lead_source` text DEFAULT 'customer' NOT NULL,
	`lead_id` integer NOT NULL,
	`operation` text DEFAULT 'upsert' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_error` text,
	`version` integer DEFAULT 0 NOT NULL,
	`locked_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `google_sheets_sync_jobs_org_status_idx` ON `google_sheets_sync_jobs` (`organization_id`,`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `google_sheets_sync_jobs_org_lead_idx` ON `google_sheets_sync_jobs` (`organization_id`,`lead_source`,`lead_id`);