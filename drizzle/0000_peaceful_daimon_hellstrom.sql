CREATE TABLE `best_scores` (
	`board` text NOT NULL,
	`player` text NOT NULL,
	`run_id` text NOT NULL,
	`score` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`shards` integer NOT NULL,
	`combo` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`board`, `player`)
);
--> statement-breakpoint
CREATE INDEX `leaderboard_order` ON `best_scores` (`board`,`score`,`created_at`);