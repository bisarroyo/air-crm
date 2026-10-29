ALTER TABLE `customers` ADD `organization_id` text REFERENCES organization(id);--> statement-breakpoint
ALTER TABLE `google_sheets_integrations` ADD `customer_cursor` integer;--> statement-breakpoint
ALTER TABLE `google_sheets_integrations` ADD `travel_cursor` integer;--> statement-breakpoint
ALTER TABLE `google_sheets_sync_jobs` ADD `lease_token` text;--> statement-breakpoint
ALTER TABLE `google_sheets_sync_jobs` ADD `protocol` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `travel_leads` ADD `organization_id` text REFERENCES organization(id);
--> statement-breakpoint
UPDATE google_sheets_sync_jobs SET protocol = 1, status = 'dead', last_error = 'Trabajo anterior sin propietario verificado; ejecutar sincronización inicial v2';
--> statement-breakpoint
CREATE TRIGGER gs_job_version AFTER INSERT ON google_sheets_sync_jobs BEGIN UPDATE google_sheets_sync_jobs SET version = NEW.id WHERE id = NEW.id; END;
--> statement-breakpoint
CREATE INDEX customers_organization_idx ON customers(organization_id, id);
--> statement-breakpoint
CREATE TRIGGER gs_customer_owner BEFORE UPDATE OF organization_id ON customers WHEN OLD.organization_id IS NOT NULL AND NEW.organization_id IS NOT OLD.organization_id BEGIN SELECT RAISE(ABORT, 'La organización del lead es inmutable'); END;
--> statement-breakpoint
CREATE TRIGGER gs_customer_insert AFTER INSERT ON customers WHEN NEW.organization_id IS NOT NULL BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT NEW.organization_id, 'customer', NEW.id, 'upsert'; END;
--> statement-breakpoint
CREATE TRIGGER gs_customer_delete AFTER DELETE ON customers WHEN OLD.organization_id IS NOT NULL BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT OLD.organization_id, 'customer', OLD.id, 'delete'; END;
--> statement-breakpoint
CREATE TRIGGER gs_customer_update AFTER UPDATE OF name, phone, email, status_id, organization_id ON customers WHEN NEW.organization_id IS NOT NULL AND (NEW.name IS NOT OLD.name OR NEW.phone IS NOT OLD.phone OR NEW.email IS NOT OLD.email OR NEW.status_id IS NOT OLD.status_id OR NEW.organization_id IS NOT OLD.organization_id) BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT NEW.organization_id, 'customer', NEW.id, 'upsert'; END;
--> statement-breakpoint
CREATE TRIGGER gs_customer_note_insert AFTER INSERT ON customer_notes BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'customer', id, 'upsert' FROM customers WHERE id = NEW.customer_id AND organization_id IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER gs_customer_note_update AFTER UPDATE OF note, created_at ON customer_notes BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'customer', id, 'upsert' FROM customers WHERE id = NEW.customer_id AND organization_id IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER gs_customer_note_delete AFTER DELETE ON customer_notes BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'customer', id, 'upsert' FROM customers WHERE id = OLD.customer_id AND organization_id IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER gs_customer_status AFTER UPDATE OF status ON status WHEN NEW.status IS NOT OLD.status BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'customer', id, 'upsert' FROM customers WHERE status_id = NEW.id AND organization_id IS NOT NULL; END;
--> statement-breakpoint
CREATE INDEX travel_leads_organization_idx ON travel_leads(organization_id, id);
--> statement-breakpoint
CREATE TRIGGER gs_travel_owner BEFORE UPDATE OF organization_id ON travel_leads WHEN OLD.organization_id IS NOT NULL AND NEW.organization_id IS NOT OLD.organization_id BEGIN SELECT RAISE(ABORT, 'La organización del lead es inmutable'); END;
--> statement-breakpoint
CREATE TRIGGER gs_travel_insert AFTER INSERT ON travel_leads WHEN NEW.organization_id IS NOT NULL BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT NEW.organization_id, 'travel', NEW.id, 'upsert'; END;
--> statement-breakpoint
CREATE TRIGGER gs_travel_delete AFTER DELETE ON travel_leads WHEN OLD.organization_id IS NOT NULL BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT OLD.organization_id, 'travel', OLD.id, 'delete'; END;
--> statement-breakpoint
CREATE TRIGGER gs_travel_update AFTER UPDATE OF name, phone, email, status_id, organization_id ON travel_leads WHEN NEW.organization_id IS NOT NULL AND (NEW.name IS NOT OLD.name OR NEW.phone IS NOT OLD.phone OR NEW.email IS NOT OLD.email OR NEW.status_id IS NOT OLD.status_id OR NEW.organization_id IS NOT OLD.organization_id) BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT NEW.organization_id, 'travel', NEW.id, 'upsert'; END;
--> statement-breakpoint
CREATE TRIGGER gs_travel_note_insert AFTER INSERT ON travel_lead_notes BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'travel', id, 'upsert' FROM travel_leads WHERE id = NEW.lead_id AND organization_id IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER gs_travel_note_update AFTER UPDATE OF note, created_at ON travel_lead_notes BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'travel', id, 'upsert' FROM travel_leads WHERE id = NEW.lead_id AND organization_id IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER gs_travel_note_delete AFTER DELETE ON travel_lead_notes BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'travel', id, 'upsert' FROM travel_leads WHERE id = OLD.lead_id AND organization_id IS NOT NULL; END;
--> statement-breakpoint
CREATE TRIGGER gs_travel_status AFTER UPDATE OF status ON travel_statuses WHEN NEW.status IS NOT OLD.status BEGIN INSERT INTO google_sheets_sync_jobs (organization_id, lead_source, lead_id, operation) SELECT organization_id, 'travel', id, 'upsert' FROM travel_leads WHERE status_id = NEW.id AND organization_id IS NOT NULL; END;
