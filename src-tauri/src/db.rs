//! db.rs — SQLite connection, migrations, first-run seed, and snapshot loader.
//!
//! Migrations run off the `user_version` pragma: each step bumps it by one.
//! On first run (no boards) we seed the exact 12 cards / 3 boards from the
//! prototype's `store.jsx::seed()` so the app opens populated.

use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use indexmap::IndexMap;
use rusqlite::{params, Connection};

use crate::model::{join_body, Board, Card, Column, Filter, Promotion, Prop, Rule, Snapshot};

/// Managed Tauri state: a single SQLite connection behind a mutex.
pub struct Db(pub Mutex<Connection>);

const MIGRATION_0001: &str = include_str!("../migrations/0001_init.sql");
const MIGRATION_0002: &str = include_str!("../migrations/0002_filter_enabled.sql");

/// Open the database, enable foreign keys, and run migrations.
pub fn open(path: &std::path::Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    migrate(&conn)?;
    Ok(conn)
}

/// Apply migrations based on `user_version`.
pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(MIGRATION_0001)?;
        conn.pragma_update(None, "user_version", 1)?;
    }
    if version < 2 {
        conn.execute_batch(MIGRATION_0002)?;
        conn.pragma_update(None, "user_version", 2)?;
    }
    Ok(())
}

/// Seed the database with sample data if it is empty (no boards).
pub fn ensure_seeded(conn: &mut Connection) -> rusqlite::Result<()> {
    let board_count: i64 = conn.query_row("SELECT COUNT(*) FROM boards", [], |r| r.get(0))?;
    if board_count == 0 {
        seed(conn)?;
    }
    Ok(())
}

// --- uid generation (mirrors store.jsx's `prefix + base36`) -----------------

fn uid(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let mut v = nanos ^ (n.wrapping_mul(0x9E37_79B9_7F4A_7C15));
    let mut s = String::new();
    const ALPHABET: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    for _ in 0..7 {
        s.push(ALPHABET[(v % 36) as usize] as char);
        v /= 36;
    }
    format!("{prefix}{s}")
}

// --- seed -------------------------------------------------------------------

struct SeedCard {
    body: &'static str,
    /// (name, type, value) in insertion order
    props: &'static [(&'static str, &'static str, &'static str)],
    /// (name, front, title)
    promos: &'static [(&'static str, bool, bool)],
}

fn seed(conn: &mut Connection) -> rusqlite::Result<()> {
    let cards: [SeedCard; 12] = [
        SeedCard {
            body: "Redesign onboarding flow\nTalk to 5 users about the first run, then sketch 3 entry points and prototype the warmest one.",
            props: &[("Status", "select", "In progress"), ("Priority", "select", "High"), ("Due", "date", "Jun 22"), ("Estimate", "int", "8"), ("Area", "select", "Design")],
            promos: &[("Priority", true, true), ("Due", true, false)],
        },
        SeedCard {
            body: "Ship dark mode\nAudit every surface for contrast and wire the theme toggle into settings.",
            props: &[("Status", "select", "In progress"), ("Priority", "select", "Medium"), ("Effort", "decimal", "3.5"), ("Area", "select", "Eng")],
            promos: &[("Priority", true, false)],
        },
        SeedCard {
            body: "Fix flaky CI pipeline\nThe integration suite times out ~1 in 5 runs. Bisect the slow tests.",
            props: &[("Status", "select", "Blocked"), ("Priority", "select", "High"), ("Area", "select", "Eng"), ("Done", "bool", "no")],
            promos: &[("Priority", false, true)],
        },
        SeedCard {
            body: "Write Q3 OKRs\nDraft 3 objectives with measurable key results and circulate for feedback.",
            props: &[("Status", "select", "Backlog"), ("Priority", "select", "Medium"), ("Due", "date", "Jul 1"), ("Area", "select", "Research")],
            promos: &[],
        },
        SeedCard {
            body: "Interview 5 power users\nRecruit from the beta cohort. Focus on workflows we don't support yet.",
            props: &[("Status", "select", "Backlog"), ("Priority", "select", "Low"), ("Area", "select", "Research"), ("Estimate", "int", "5")],
            promos: &[],
        },
        SeedCard {
            body: "Migrate to new icon set\nReplace the 40 most-used glyphs and delete the old sprite sheet.",
            props: &[("Status", "select", "Done"), ("Priority", "select", "Low"), ("Area", "select", "Design"), ("Done", "bool", "yes")],
            promos: &[("Done", false, true)],
        },
        SeedCard {
            body: "Launch referral program\nDefine the reward tiers and the share surface. Coordinate with growth.",
            props: &[("Status", "select", "Backlog"), ("Priority", "select", "High"), ("Due", "date", "Aug 15"), ("Area", "select", "Eng")],
            promos: &[("Priority", true, false), ("Due", true, true)],
        },
        SeedCard {
            body: "Refactor settings module\nIt's grown into a 2k-line file. Split by domain and add tests.",
            props: &[("Status", "select", "In progress"), ("Priority", "select", "Medium"), ("Effort", "decimal", "5.0"), ("Area", "select", "Eng")],
            promos: &[],
        },
        SeedCard {
            body: "Thinking in Systems — Donella Meadows\nFoundational mental models for feedback loops.",
            props: &[("Shelf", "select", "Reading"), ("Rating", "int", "5"), ("Link", "url", "https://example.com/systems")],
            promos: &[("Rating", true, true)],
        },
        SeedCard {
            body: "The Design of Everyday Things — Norman\nThe classic on affordances and signifiers.",
            props: &[("Shelf", "select", "Finished"), ("Rating", "int", "4")],
            promos: &[("Rating", false, true)],
        },
        SeedCard {
            body: "Shape Up — Basecamp\nAppetite-driven planning and the hill chart.",
            props: &[("Shelf", "select", "To read"), ("Link", "url", "https://basecamp.com/shapeup")],
            promos: &[],
        },
        SeedCard {
            body: "A Pattern Language — Alexander\nWhere a lot of modern design vocabulary comes from.",
            props: &[("Shelf", "select", "Reading"), ("Rating", "int", "5")],
            promos: &[("Rating", true, false)],
        },
    ];

    let tx = conn.transaction()?;
    // Stable, increasing `created` so insertion order == display order.
    let base: i64 = 1_700_000_000_000;
    for (i, sc) in cards.iter().enumerate() {
        let id = uid("c_");
        let (title, notes) = crate::model::split_body(sc.body);
        tx.execute(
            "INSERT INTO cards (id, title, notes, created, ord) VALUES (?1, ?2, ?3, ?4, NULL)",
            params![id, title, notes, base + i as i64],
        )?;
        for (name, ty, value) in sc.props {
            tx.execute(
                "INSERT INTO card_props (card_id, name, type, value) VALUES (?1, ?2, ?3, ?4)",
                params![id, name, ty, value],
            )?;
        }
        for (name, front, title_pin) in sc.promos {
            tx.execute(
                "INSERT INTO card_promotions (card_id, name, front, title) VALUES (?1, ?2, ?3, ?4)",
                params![id, name, *front as i64, *title_pin as i64],
            )?;
        }
    }

    // Boards
    let b1 = uid("b_");
    let b2 = uid("b_");
    let b3 = uid("b_");

    tx.execute(
        "INSERT INTO boards (id, name, color, group_by, filter_connector, filter_open, ord) VALUES (?1,?2,?3,?4,'AND',0,0)",
        params![b1, "Product Sprint", "#6366f1", "Status"],
    )?;
    // `Archived` is intentionally empty (no card has Status=Archived) to prove
    // empty columns persist in the materialized list (spec §3.7).
    for (val, color, ord) in [
        ("Backlog", "#64748b", 0),
        ("In progress", "#3b82f6", 1),
        ("Blocked", "#ef4444", 2),
        ("Done", "#22c55e", 3),
        ("Archived", "#8b5cf6", 4),
    ] {
        tx.execute(
            "INSERT INTO board_columns (board_id, property, value, color, ord, hidden) VALUES (?1,?2,?3,?4,?5,0)",
            params![b1, "Status", val, color, ord],
        )?;
    }

    tx.execute(
        "INSERT INTO boards (id, name, color, group_by, filter_connector, filter_open, ord) VALUES (?1,?2,?3,?4,'AND',0,1)",
        params![b2, "By Priority", "#ec4899", "Priority"],
    )?;
    tx.execute(
        "INSERT INTO board_filter_rules (id, board_id, prop, op, value, value2, ord) VALUES (?1,?2,?3,?4,?5,NULL,0)",
        params![uid("r_"), b2, "Area", "is", "Eng"],
    )?;
    for (val, color, ord) in [
        ("High", "#ef4444", 0),
        ("Medium", "#f59e0b", 1),
        ("Low", "#22c55e", 2),
    ] {
        tx.execute(
            "INSERT INTO board_columns (board_id, property, value, color, ord, hidden) VALUES (?1,?2,?3,?4,?5,0)",
            params![b2, "Priority", val, color, ord],
        )?;
    }

    tx.execute(
        "INSERT INTO boards (id, name, color, group_by, filter_connector, filter_open, ord) VALUES (?1,?2,?3,?4,'AND',0,2)",
        params![b3, "Reading List", "#14b8a6", "Shelf"],
    )?;
    for (val, color, ord) in [
        ("To read", "#f59e0b", 0),
        ("Reading", "#3b82f6", 1),
        ("Finished", "#22c55e", 2),
    ] {
        tx.execute(
            "INSERT INTO board_columns (board_id, property, value, color, ord, hidden) VALUES (?1,?2,?3,?4,?5,0)",
            params![b3, "Shelf", val, color, ord],
        )?;
    }

    tx.execute(
        "INSERT INTO app_meta (key, value) VALUES ('active_board_id', ?1)",
        params![b1],
    )?;
    tx.execute(
        "INSERT INTO app_meta (key, value) VALUES ('schema_version', '1')",
        [],
    )?;

    tx.commit()?;
    Ok(())
}

// --- snapshot loader --------------------------------------------------------

/// Read the entire persisted state into a `Snapshot` for the frontend.
pub fn load_snapshot(conn: &Connection) -> rusqlite::Result<Snapshot> {
    let mut cards: IndexMap<String, Card> = IndexMap::new();

    {
        let mut stmt = conn
            .prepare("SELECT id, title, notes, created, ord FROM cards ORDER BY created, rowid")?;
        let rows = stmt.query_map([], |r| {
            let id: String = r.get(0)?;
            let title: String = r.get(1)?;
            let notes: String = r.get(2)?;
            let created: i64 = r.get(3)?;
            let ord: Option<i64> = r.get(4)?;
            Ok((id, title, notes, created, ord))
        })?;
        for row in rows {
            let (id, title, notes, created, ord) = row?;
            cards.insert(
                id.clone(),
                Card {
                    id,
                    body: join_body(&title, &notes),
                    props: IndexMap::new(),
                    promotions: IndexMap::new(),
                    created,
                    ord,
                },
            );
        }
    }

    {
        let mut stmt =
            conn.prepare("SELECT card_id, name, type, value FROM card_props ORDER BY rowid")?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })?;
        for row in rows {
            let (card_id, name, ptype, value) = row?;
            if let Some(card) = cards.get_mut(&card_id) {
                card.props.insert(name, Prop { ptype, value });
            }
        }
    }

    {
        let mut stmt =
            conn.prepare("SELECT card_id, name, front, title FROM card_promotions ORDER BY rowid")?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)? != 0,
                r.get::<_, i64>(3)? != 0,
            ))
        })?;
        for row in rows {
            let (card_id, name, front, title) = row?;
            if let Some(card) = cards.get_mut(&card_id) {
                card.promotions.insert(name, Promotion { front, title });
            }
        }
    }

    // Boards
    let mut boards: Vec<Board> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT id, name, color, group_by, filter_connector, filter_open, filter_enabled FROM boards ORDER BY ord, rowid",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, i64>(5)? != 0,
                r.get::<_, i64>(6)? != 0,
            ))
        })?;
        for row in rows {
            let (id, name, color, group_by, connector, filter_open, filter_enabled) = row?;
            boards.push(Board {
                id,
                name,
                color,
                group_by,
                filter: Filter {
                    connector,
                    rules: Vec::new(),
                    enabled: filter_enabled,
                },
                filter_open,
                columns_by_property: IndexMap::new(),
                collapsed: IndexMap::new(),
            });
        }
    }

    {
        let mut stmt = conn.prepare(
            "SELECT board_id, id, prop, op, value, value2 FROM board_filter_rules ORDER BY ord, rowid",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, Option<String>>(4)?,
                r.get::<_, Option<String>>(5)?,
            ))
        })?;
        for row in rows {
            let (board_id, id, prop, op, value, value2) = row?;
            let rule_value = if op == "between" {
                serde_json::json!([value.unwrap_or_default(), value2.unwrap_or_default()])
            } else {
                serde_json::Value::String(value.unwrap_or_default())
            };
            if let Some(b) = boards.iter_mut().find(|b| b.id == board_id) {
                b.filter.rules.push(Rule {
                    id,
                    prop,
                    op,
                    value: rule_value,
                });
            }
        }
    }

    {
        // Ordered by (property, ord) so each property's Vec<Column> is built in
        // left-to-right order; rebuild `columns_by_property` per board.
        let mut stmt = conn.prepare(
            "SELECT board_id, property, value, color, hidden FROM board_columns ORDER BY property, ord, rowid",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, i64>(4)? != 0,
            ))
        })?;
        for row in rows {
            let (board_id, property, value, color, hidden) = row?;
            if let Some(b) = boards.iter_mut().find(|b| b.id == board_id) {
                b.columns_by_property.entry(property).or_default().push(Column {
                    value,
                    color,
                    hidden: Some(hidden),
                });
            }
        }
    }

    {
        let mut stmt = conn.prepare("SELECT board_id, card_id, collapsed FROM card_collapsed")?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)? != 0,
            ))
        })?;
        for row in rows {
            let (board_id, card_id, collapsed) = row?;
            if let Some(b) = boards.iter_mut().find(|b| b.id == board_id) {
                b.collapsed.insert(card_id, collapsed);
            }
        }
    }

    let active_board_id: Option<String> = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key = 'active_board_id'",
            [],
            |r| r.get::<_, Option<String>>(0),
        )
        .unwrap_or(None);

    Ok(Snapshot {
        cards,
        boards,
        active_board_id,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&conn).unwrap();
        conn
    }

    #[test]
    fn seeds_and_loads_snapshot() {
        let mut conn = mem();
        ensure_seeded(&mut conn).unwrap();
        // idempotent: a second call must not duplicate
        ensure_seeded(&mut conn).unwrap();

        let snap = load_snapshot(&conn).unwrap();
        assert_eq!(snap.cards.len(), 12, "12 seed cards");
        assert_eq!(snap.boards.len(), 3, "3 seed boards");
        assert!(snap.active_board_id.is_some());

        let b0 = &snap.boards[0];
        assert_eq!(b0.name, "Product Sprint");
        assert_eq!(b0.group_by.as_deref(), Some("Status"));
        let status_cols = &b0.columns_by_property["Status"];
        assert_eq!(status_cols.len(), 5); // 4 populated + empty "Archived"
        // order preserved from seed; empty column kept
        let vals: Vec<&str> = status_cols.iter().map(|c| c.value.as_str()).collect();
        assert_eq!(vals, vec!["Backlog", "In progress", "Blocked", "Done", "Archived"]);
        assert_eq!(snap.active_board_id.as_deref(), Some(b0.id.as_str()));

        let b1 = &snap.boards[1];
        assert_eq!(b1.filter.rules.len(), 1);
        assert_eq!(b1.filter.rules[0].prop, "Area");
        assert_eq!(b1.filter.rules[0].op, "is");

        // property insertion order must be preserved (rowid order)
        let first = snap.cards.values().next().unwrap();
        assert_eq!(first.body.lines().next(), Some("Redesign onboarding flow"));
        let names: Vec<&str> = first.props.keys().map(String::as_str).collect();
        assert_eq!(names, vec!["Status", "Priority", "Due", "Estimate", "Area"]);
        let promo = first.promotions.get("Priority").unwrap();
        assert!(promo.front && promo.title);
    }

    #[test]
    fn snapshot_serializes_columns_by_property_camelcase() {
        // Guards the IPC shape the frontend consumes (Board.columnsByProperty).
        let mut conn = mem();
        ensure_seeded(&mut conn).unwrap();
        let snap = load_snapshot(&conn).unwrap();
        let json = serde_json::to_string(&snap).unwrap();
        assert!(json.contains("\"columnsByProperty\""));
        assert!(!json.contains("\"columns_by_property\""));
        // a column object carries its `value`
        assert!(json.contains("\"value\":\"Backlog\""));
    }
}
