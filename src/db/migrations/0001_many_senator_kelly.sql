CREATE TABLE `admin_action_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`target_mechanic_id` text,
	`action` text NOT NULL,
	`note` text,
	`before_state` text DEFAULT '{}' NOT NULL,
	`after_state` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_mechanic_id`) REFERENCES `mechanics`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "admin_action_log_action_check" CHECK("admin_action_log"."action" IN ('create_mechanic', 'delete_mechanic')),
	CONSTRAINT "admin_action_log_note_length_check" CHECK(length(coalesce("admin_action_log"."note", '')) <= 500)
);
--> statement-breakpoint
CREATE INDEX `admin_action_log_target_created_idx` ON `admin_action_log` (`target_mechanic_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `admin_action_log_actor_created_idx` ON `admin_action_log` (`actor_id`,"created_at" desc);--> statement-breakpoint
CREATE TABLE `appointment_service_items` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointment_service_reports`(`appointment_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "appointment_service_items_description_length_check" CHECK(length(trim("appointment_service_items"."description")) BETWEEN 2 AND 160),
	CONSTRAINT "appointment_service_items_amount_cents_check" CHECK("appointment_service_items"."amount_cents" >= 0),
	CONSTRAINT "appointment_service_items_sort_order_check" CHECK("appointment_service_items"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE INDEX `appointment_service_items_appointment_order_idx` ON `appointment_service_items` (`appointment_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `appointment_service_reports` (
	`appointment_id` text PRIMARY KEY NOT NULL,
	`mechanic_id` text NOT NULL,
	`summary` text NOT NULL,
	`diagnosis` text,
	`work_performed` text NOT NULL,
	`parts_used` text,
	`recommendations` text,
	`total_amount_cents` integer NOT NULL,
	`closed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mechanic_id`) REFERENCES `mechanics`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "appointment_service_reports_summary_length_check" CHECK(length(trim("appointment_service_reports"."summary")) BETWEEN 3 AND 240),
	CONSTRAINT "appointment_service_reports_diagnosis_length_check" CHECK(length(coalesce("appointment_service_reports"."diagnosis", '')) <= 1000),
	CONSTRAINT "appointment_service_reports_work_performed_length_check" CHECK(length(trim("appointment_service_reports"."work_performed")) BETWEEN 3 AND 2000),
	CONSTRAINT "appointment_service_reports_parts_used_length_check" CHECK(length(coalesce("appointment_service_reports"."parts_used", '')) <= 1000),
	CONSTRAINT "appointment_service_reports_recommendations_length_check" CHECK(length(coalesce("appointment_service_reports"."recommendations", '')) <= 1000),
	CONSTRAINT "appointment_service_reports_total_amount_cents_check" CHECK("appointment_service_reports"."total_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `appointment_service_reports_mechanic_closed_idx` ON `appointment_service_reports` (`mechanic_id`,"closed_at" desc);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`mechanic_id` text NOT NULL,
	`timeslot_id` text,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`status` text DEFAULT 'confirmado' NOT NULL,
	`vehicle_info` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mechanic_id`) REFERENCES `mechanics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`timeslot_id`) REFERENCES `timeslots`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "appointments_status_check" CHECK("appointments"."status" IN ('confirmado', 'nao_finalizado', 'cancelado', 'acabado')),
	CONSTRAINT "appointments_time_order_check" CHECK("appointments"."end_time" > "appointments"."start_time"),
	CONSTRAINT "appointments_vehicle_info_length_check" CHECK(length(coalesce("appointments"."vehicle_info", '')) <= 120),
	CONSTRAINT "appointments_notes_length_check" CHECK(length(coalesce("appointments"."notes", '')) <= 1000)
);
--> statement-breakpoint
CREATE INDEX `appointments_client_date_desc_idx` ON `appointments` (`client_id`,"date" desc);--> statement-breakpoint
CREATE INDEX `appointments_mechanic_date_desc_idx` ON `appointments` (`mechanic_id`,"date" desc);--> statement-breakpoint
CREATE INDEX `appointments_date_status_mechanic_idx` ON `appointments` ("date" desc,`status`,`mechanic_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_one_active_per_timeslot` ON `appointments` (`timeslot_id`) WHERE "appointments"."status" IN ('confirmado', 'nao_finalizado') AND "appointments"."timeslot_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `mechanics` (
	`id` text PRIMARY KEY NOT NULL,
	`specialty` text NOT NULL,
	`credentials` text DEFAULT 'PENDENTE' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mechanics_active_credentials_idx` ON `mechanics` (`is_active`,`credentials`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_id` text NOT NULL,
	`actor_id` text,
	`appointment_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_created_idx` ON `notifications` (`recipient_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `notifications_recipient_unread_idx` ON `notifications` (`recipient_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `public_mechanics` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`specialty` text NOT NULL,
	`avatar_url` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `mechanics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `timeslots` (
	`id` text PRIMARY KEY NOT NULL,
	`mechanic_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`mechanic_id`) REFERENCES `mechanics`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "timeslots_time_order_check" CHECK("timeslots"."end_time" > "timeslots"."start_time")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timeslots_mechanic_date_time_unique_idx` ON `timeslots` (`mechanic_id`,`date`,`start_time`,`end_time`);--> statement-breakpoint
CREATE INDEX `timeslots_mechanic_date_available_start_idx` ON `timeslots` (`mechanic_id`,`date`,`is_available`,`start_time`);