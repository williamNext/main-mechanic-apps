CREATE TABLE `token_blocklist` (
	`jti` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer NOT NULL
);
