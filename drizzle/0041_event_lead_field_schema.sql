ALTER TABLE `events` ADD `lead_field_schema_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `leads` ADD `custom_fields_json` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER event_lead_field_schema_validate_insert BEFORE INSERT ON events
BEGIN
  SELECT CASE WHEN json_valid(NEW.lead_field_schema_json)!=1 OR json_type(NEW.lead_field_schema_json)!='array' THEN RAISE(ABORT, 'lead_field_schema_json must be a JSON array') END;
END;
--> statement-breakpoint
CREATE TRIGGER event_lead_field_schema_validate_update BEFORE UPDATE ON events
BEGIN
  SELECT CASE WHEN json_valid(NEW.lead_field_schema_json)!=1 OR json_type(NEW.lead_field_schema_json)!='array' THEN RAISE(ABORT, 'lead_field_schema_json must be a JSON array') END;
END;
--> statement-breakpoint
CREATE TRIGGER lead_custom_fields_validate_insert BEFORE INSERT ON leads
BEGIN
  SELECT CASE WHEN json_valid(NEW.custom_fields_json)!=1 OR json_type(NEW.custom_fields_json)!='object' THEN RAISE(ABORT, 'custom_fields_json must be a JSON object') END;
END;
--> statement-breakpoint
CREATE TRIGGER lead_custom_fields_validate_update BEFORE UPDATE ON leads
BEGIN
  SELECT CASE WHEN json_valid(NEW.custom_fields_json)!=1 OR json_type(NEW.custom_fields_json)!='object' THEN RAISE(ABORT, 'custom_fields_json must be a JSON object') END;
END;
