-- This rebuild is safe despite PROJECT_CONTEXT.md §7.2's general prohibition because admin_action_log is a pure child of profiles and mechanics, not a parent table: no foreign key points at it, so DROP TABLE fires no child cascade; §7.2 forbids rebuilding parent tables where DROP TABLE silently deletes child rows and foreign_key_check then reports clean.
CREATE TABLE `__new_admin_action_log` (
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
	CONSTRAINT "admin_action_log_action_check" CHECK("__new_admin_action_log"."action" IN ('create_mechanic', 'delete_mechanic', 'deactivate_mechanic', 'reactivate_mechanic')),
	CONSTRAINT "admin_action_log_note_length_check" CHECK(length(coalesce("__new_admin_action_log"."note", '')) <= 500)
);
--> statement-breakpoint
INSERT INTO `__new_admin_action_log`("id", "actor_id", "target_mechanic_id", "action", "note", "before_state", "after_state", "created_at") SELECT "id", "actor_id", "target_mechanic_id", "action", "note", "before_state", "after_state", "created_at" FROM `admin_action_log`;--> statement-breakpoint
DROP TABLE `admin_action_log`;--> statement-breakpoint
ALTER TABLE `__new_admin_action_log` RENAME TO `admin_action_log`;--> statement-breakpoint
CREATE INDEX `admin_action_log_target_created_idx` ON `admin_action_log` (`target_mechanic_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `admin_action_log_actor_created_idx` ON `admin_action_log` (`actor_id`,"created_at" desc);
