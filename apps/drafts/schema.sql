-- Review actions queued from the drafts site, drained by the local drafter.
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('revise', 'approve', 'kill', 'park', 'cover')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'working', 'done', 'failed')),
  result TEXT,
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS actions_status ON actions (status);
CREATE INDEX IF NOT EXISTS actions_slug ON actions (slug);
