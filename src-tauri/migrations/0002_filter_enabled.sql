-- 0002_filter_enabled.sql
-- Adds a per-board flag that lets a filter be disabled without losing its rules.
-- Existing boards default to enabled (1) so behaviour is unchanged after upgrade.

ALTER TABLE boards ADD COLUMN filter_enabled INTEGER NOT NULL DEFAULT 1;
