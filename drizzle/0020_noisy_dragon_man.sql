DROP INDEX `google_sheets_integrations_org_uidx`;--> statement-breakpoint
ALTER TABLE `google_sheets_integrations` ADD `name` text DEFAULT 'Integración' NOT NULL;--> statement-breakpoint
ALTER TABLE `google_sheets_integrations` ADD `sync_customers` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `google_sheets_integrations` ADD `sync_travel` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `google_sheets_integrations` ADD `customer_status_ids` text;--> statement-breakpoint
ALTER TABLE `google_sheets_integrations` ADD `travel_status_ids` text;--> statement-breakpoint
CREATE INDEX `google_sheets_integrations_org_idx` ON `google_sheets_integrations` (`organization_id`);--> statement-breakpoint
ALTER TABLE `google_sheets_sync_jobs` ADD `integration_id` integer REFERENCES google_sheets_integrations(id);--> statement-breakpoint
CREATE INDEX `google_sheets_sync_jobs_integration_status_idx` ON `google_sheets_sync_jobs` (`integration_id`,`status`,`next_attempt_at`);--> statement-breakpoint
UPDATE `google_sheets_sync_jobs`
SET `status` = 'dead',
	`last_error` = 'Trabajo anterior a las integraciones múltiples; ejecutá una sincronización inicial'
WHERE `integration_id` IS NULL
	AND `protocol` = 2
	AND `status` IN ('pending', 'failed', 'processing');--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_customer_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_customer_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_customer_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_customer_note_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_customer_note_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_customer_note_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_customer_status`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_travel_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_travel_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_travel_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_travel_note_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_travel_note_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_travel_note_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `gs_travel_status`;--> statement-breakpoint
CREATE TRIGGER `gs_customer_insert` AFTER INSERT ON `customers`
WHEN NEW.`organization_id` IS NOT NULL
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'customer', NEW.`id`, 'upsert'
	FROM `google_sheets_integrations` i
	WHERE i.`organization_id` = NEW.`organization_id` AND i.`sync_customers` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `gs_customer_delete` AFTER DELETE ON `customers`
WHEN OLD.`organization_id` IS NOT NULL
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'customer', OLD.`id`, 'delete'
	FROM `google_sheets_integrations` i
	WHERE i.`organization_id` = OLD.`organization_id` AND i.`sync_customers` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `gs_customer_update` AFTER UPDATE OF `name`, `phone`, `email`, `status_id`, `organization_id` ON `customers`
WHEN NEW.`organization_id` IS NOT NULL AND (NEW.`name` IS NOT OLD.`name` OR NEW.`phone` IS NOT OLD.`phone` OR NEW.`email` IS NOT OLD.`email` OR NEW.`status_id` IS NOT OLD.`status_id` OR NEW.`organization_id` IS NOT OLD.`organization_id`)
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'customer', NEW.`id`, 'upsert'
	FROM `google_sheets_integrations` i
	WHERE i.`organization_id` = NEW.`organization_id` AND i.`sync_customers` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `gs_customer_note_insert` AFTER INSERT ON `customer_notes`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'customer', c.`id`, 'upsert'
	FROM `customers` c
	JOIN `google_sheets_integrations` i ON i.`organization_id` = c.`organization_id` AND i.`sync_customers` = 1
	WHERE c.`id` = NEW.`customer_id` AND c.`organization_id` IS NOT NULL;
END;--> statement-breakpoint
CREATE TRIGGER `gs_customer_note_update` AFTER UPDATE OF `note`, `created_at` ON `customer_notes`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'customer', c.`id`, 'upsert'
	FROM `customers` c
	JOIN `google_sheets_integrations` i ON i.`organization_id` = c.`organization_id` AND i.`sync_customers` = 1
	WHERE c.`id` = NEW.`customer_id` AND c.`organization_id` IS NOT NULL;
END;--> statement-breakpoint
CREATE TRIGGER `gs_customer_note_delete` AFTER DELETE ON `customer_notes`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'customer', c.`id`, 'upsert'
	FROM `customers` c
	JOIN `google_sheets_integrations` i ON i.`organization_id` = c.`organization_id` AND i.`sync_customers` = 1
	WHERE c.`id` = OLD.`customer_id` AND c.`organization_id` IS NOT NULL;
END;--> statement-breakpoint
CREATE TRIGGER `gs_customer_status` AFTER UPDATE OF `status` ON `status`
WHEN NEW.`status` IS NOT OLD.`status`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'customer', c.`id`, 'upsert'
	FROM `customers` c
	JOIN `google_sheets_integrations` i ON i.`organization_id` = c.`organization_id` AND i.`sync_customers` = 1
	WHERE c.`status_id` = NEW.`id` AND c.`organization_id` IS NOT NULL;
END;--> statement-breakpoint
CREATE TRIGGER `gs_travel_insert` AFTER INSERT ON `travel_leads`
WHEN NEW.`organization_id` IS NOT NULL
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'travel', NEW.`id`, 'upsert'
	FROM `google_sheets_integrations` i
	WHERE i.`organization_id` = NEW.`organization_id` AND i.`sync_travel` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `gs_travel_delete` AFTER DELETE ON `travel_leads`
WHEN OLD.`organization_id` IS NOT NULL
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'travel', OLD.`id`, 'delete'
	FROM `google_sheets_integrations` i
	WHERE i.`organization_id` = OLD.`organization_id` AND i.`sync_travel` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `gs_travel_update` AFTER UPDATE OF `name`, `phone`, `email`, `status_id`, `organization_id` ON `travel_leads`
WHEN NEW.`organization_id` IS NOT NULL AND (NEW.`name` IS NOT OLD.`name` OR NEW.`phone` IS NOT OLD.`phone` OR NEW.`email` IS NOT OLD.`email` OR NEW.`status_id` IS NOT OLD.`status_id` OR NEW.`organization_id` IS NOT OLD.`organization_id`)
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'travel', NEW.`id`, 'upsert'
	FROM `google_sheets_integrations` i
	WHERE i.`organization_id` = NEW.`organization_id` AND i.`sync_travel` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `gs_travel_note_insert` AFTER INSERT ON `travel_lead_notes`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'travel', l.`id`, 'upsert'
	FROM `travel_leads` l
	JOIN `google_sheets_integrations` i ON i.`organization_id` = l.`organization_id` AND i.`sync_travel` = 1
	WHERE l.`id` = NEW.`lead_id` AND l.`organization_id` IS NOT NULL;
END;--> statement-breakpoint
CREATE TRIGGER `gs_travel_note_update` AFTER UPDATE OF `note`, `created_at` ON `travel_lead_notes`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'travel', l.`id`, 'upsert'
	FROM `travel_leads` l
	JOIN `google_sheets_integrations` i ON i.`organization_id` = l.`organization_id` AND i.`sync_travel` = 1
	WHERE l.`id` = NEW.`lead_id` AND l.`organization_id` IS NOT NULL;
END;--> statement-breakpoint
CREATE TRIGGER `gs_travel_note_delete` AFTER DELETE ON `travel_lead_notes`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'travel', l.`id`, 'upsert'
	FROM `travel_leads` l
	JOIN `google_sheets_integrations` i ON i.`organization_id` = l.`organization_id` AND i.`sync_travel` = 1
	WHERE l.`id` = OLD.`lead_id` AND l.`organization_id` IS NOT NULL;
END;--> statement-breakpoint
CREATE TRIGGER `gs_travel_status` AFTER UPDATE OF `status` ON `travel_statuses`
WHEN NEW.`status` IS NOT OLD.`status`
BEGIN
	INSERT INTO `google_sheets_sync_jobs` (`organization_id`, `integration_id`, `lead_source`, `lead_id`, `operation`)
	SELECT i.`organization_id`, i.`id`, 'travel', l.`id`, 'upsert'
	FROM `travel_leads` l
	JOIN `google_sheets_integrations` i ON i.`organization_id` = l.`organization_id` AND i.`sync_travel` = 1
	WHERE l.`status_id` = NEW.`id` AND l.`organization_id` IS NOT NULL;
END;