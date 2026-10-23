// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
export const bestScores = sqliteTable('best_scores', {
  board: text('board').notNull(),
  player: text('player').notNull(),
  runId: text('run_id').notNull(),
  score: integer('score').notNull(),
  durationMs: integer('duration_ms').notNull(),
  shards: integer('shards').notNull(),
  combo: integer('combo').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [primaryKey({columns:[t.board,t.player]}),index('leaderboard_order').on(t.board,t.score,t.createdAt)]);
