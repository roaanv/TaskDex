-- TaskDex schema v1 — normalizes the prototype's localStorage state into SQLite.
-- Applied when user_version = 0; see db.rs for the migration runner.

CREATE TABLE cards (
  id      TEXT PRIMARY KEY,
  title   TEXT NOT NULL DEFAULT '',
  notes   TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  ord     INTEGER
);

CREATE TABLE card_props (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  type    TEXT NOT NULL,
  value   TEXT NOT NULL,
  PRIMARY KEY (card_id, name)
);

CREATE TABLE card_promotions (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  front   INTEGER NOT NULL DEFAULT 0,
  title   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (card_id, name)
);

CREATE TABLE boards (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  color            TEXT NOT NULL,
  group_by         TEXT,
  filter_connector TEXT NOT NULL DEFAULT 'AND',
  filter_open      INTEGER NOT NULL DEFAULT 0,
  ord              INTEGER NOT NULL
);

CREATE TABLE board_filter_rules (
  id       TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  prop     TEXT NOT NULL,
  op       TEXT NOT NULL,
  value    TEXT,
  value2   TEXT,            -- value2 only used by the 'between' op
  ord      INTEGER NOT NULL
);

CREATE TABLE board_columns (
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  property TEXT NOT NULL,            -- which group-by property this column belongs to
  value    TEXT NOT NULL,            -- the group value (join key to card_props.value)
  color    TEXT,
  hidden   INTEGER NOT NULL DEFAULT 0,
  ord      INTEGER NOT NULL,         -- position within (board_id, property); 0-based, dense
  PRIMARY KEY (board_id, property, value)
);

CREATE TABLE card_collapsed (
  board_id  TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  card_id   TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  collapsed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (board_id, card_id)
);

CREATE TABLE app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);  -- 'active_board_id', 'theme_pref', 'schema_version'

CREATE INDEX idx_card_props_card ON card_props(card_id);
CREATE INDEX idx_card_promotions_card ON card_promotions(card_id);
CREATE INDEX idx_board_filter_rules_board ON board_filter_rules(board_id);
CREATE INDEX idx_board_columns_board_prop ON board_columns(board_id, property);
CREATE INDEX idx_card_collapsed_board ON card_collapsed(board_id);
