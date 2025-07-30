CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone_number` text NOT NULL,
	`role` text NOT NULL,
	`content` text,
	`timestamp` text DEFAULT current_timestamp NOT NULL,
	`tool_call_id` text,
	`string` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone_number` text NOT NULL,
	`profile_name` text NOT NULL,
	`created_at` text DEFAULT current_timestamp NOT NULL,
	`updated_at` text
);
