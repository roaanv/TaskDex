//! ops.rs — the persistence logic for every mutation, as plain functions over a
//! `Connection`. The Tauri commands in `commands.rs` are thin wrappers that lock
//! the connection and delegate here, which keeps the IPC layer trivial and lets
//! this logic be unit-tested directly. Each function mirrors a `reducer.ts` action.

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use crate::model::{split_body, Card};

fn pstr<'a>(patch: &'a Value, key: &str) -> Option<&'a str> {
    patch.get(key).and_then(Value::as_str)
}

pub fn set_meta(conn: &Connection, key: &str, value: Option<&str>) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO app_meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_theme_pref(conn: &Connection) -> rusqlite::Result<String> {
    let pref: Option<String> = conn
        .query_row(
            "SELECT value FROM app_meta WHERE key='theme_pref'",
            [],
            |r| r.get(0),
        )
        .optional()?
        .flatten();
    Ok(pref.unwrap_or_else(|| "dark".to_string()))
}

pub fn set_theme_pref(conn: &Connection, pref: &str) -> rusqlite::Result<()> {
    set_meta(conn, "theme_pref", Some(pref))
}

// === cards ==================================================================

pub fn add_card(conn: &mut Connection, card: &Card) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let (title, notes) = split_body(&card.body);
    tx.execute(
        "INSERT INTO cards (id, title, notes, created, ord) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![card.id, title, notes, card.created, card.ord],
    )?;
    for (name, p) in &card.props {
        tx.execute(
            "INSERT INTO card_props (card_id, name, type, value) VALUES (?1, ?2, ?3, ?4)",
            params![card.id, name, p.ptype, p.value],
        )?;
    }
    for (name, promo) in &card.promotions {
        tx.execute(
            "INSERT INTO card_promotions (card_id, name, front, title) VALUES (?1, ?2, ?3, ?4)",
            params![card.id, name, promo.front as i64, promo.title as i64],
        )?;
    }
    tx.commit()
}

pub fn update_card(conn: &Connection, id: &str, patch: &Value) -> rusqlite::Result<()> {
    if let Some(body) = pstr(patch, "body") {
        let (title, notes) = split_body(body);
        conn.execute(
            "UPDATE cards SET title = ?2, notes = ?3 WHERE id = ?1",
            params![id, title, notes],
        )?;
    }
    if patch.get("ord").is_some() {
        let ord = patch.get("ord").and_then(Value::as_i64);
        conn.execute("UPDATE cards SET ord = ?2 WHERE id = ?1", params![id, ord])?;
    }
    Ok(())
}

pub fn delete_card(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM cards WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn set_prop(
    conn: &Connection,
    id: &str,
    name: &str,
    value: &str,
    ptype: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO card_props (card_id, name, type, value) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(card_id, name) DO UPDATE SET type = excluded.type, value = excluded.value",
        params![id, name, ptype, value],
    )?;
    Ok(())
}

pub fn rename_prop(conn: &mut Connection, id: &str, from: &str, to: &str) -> rusqlite::Result<()> {
    if to.is_empty() || from == to {
        return Ok(());
    }
    let tx = conn.transaction()?;
    // overwrite any existing `to` so the rename can't violate the PK
    tx.execute(
        "DELETE FROM card_props WHERE card_id = ?1 AND name = ?2",
        params![id, to],
    )?;
    tx.execute(
        "UPDATE card_props SET name = ?3 WHERE card_id = ?1 AND name = ?2",
        params![id, from, to],
    )?;
    tx.execute(
        "DELETE FROM card_promotions WHERE card_id = ?1 AND name = ?2",
        params![id, to],
    )?;
    tx.execute(
        "UPDATE card_promotions SET name = ?3 WHERE card_id = ?1 AND name = ?2",
        params![id, from, to],
    )?;
    tx.commit()
}

pub fn remove_prop(conn: &mut Connection, id: &str, name: &str) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM card_props WHERE card_id = ?1 AND name = ?2",
        params![id, name],
    )?;
    tx.execute(
        "DELETE FROM card_promotions WHERE card_id = ?1 AND name = ?2",
        params![id, name],
    )?;
    tx.commit()
}

pub fn toggle_promote(
    conn: &Connection,
    id: &str,
    name: &str,
    front: bool,
    title: bool,
) -> rusqlite::Result<()> {
    if !front && !title {
        conn.execute(
            "DELETE FROM card_promotions WHERE card_id = ?1 AND name = ?2",
            params![id, name],
        )?;
    } else {
        conn.execute(
            "INSERT INTO card_promotions (card_id, name, front, title) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(card_id, name) DO UPDATE SET front = excluded.front, title = excluded.title",
            params![id, name, front as i64, title as i64],
        )?;
    }
    Ok(())
}

pub fn move_to_column(
    conn: &Connection,
    id: &str,
    board_id: &str,
    value: &str,
) -> rusqlite::Result<()> {
    let group_by: Option<String> = conn
        .query_row(
            "SELECT group_by FROM boards WHERE id = ?1",
            params![board_id],
            |r| r.get(0),
        )
        .optional()?
        .flatten();
    let Some(group_by) = group_by else {
        return Ok(());
    };

    let existing_type: Option<String> = conn
        .query_row(
            "SELECT type FROM card_props WHERE card_id = ?1 AND name = ?2",
            params![id, group_by],
            |r| r.get(0),
        )
        .optional()?;
    let ptype = existing_type.unwrap_or_else(|| "select".to_string());

    conn.execute(
        "INSERT INTO card_props (card_id, name, type, value) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(card_id, name) DO UPDATE SET type = excluded.type, value = excluded.value",
        params![id, group_by, ptype, value],
    )?;
    Ok(())
}

pub fn reorder_cards(conn: &mut Connection, order: &[String]) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    for (i, id) in order.iter().enumerate() {
        tx.execute(
            "UPDATE cards SET ord = ?2 WHERE id = ?1",
            params![id, i as i64],
        )?;
    }
    tx.commit()
}

pub fn set_collapsed(
    conn: &Connection,
    board_id: &str,
    card_id: &str,
    value: bool,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO card_collapsed (board_id, card_id, collapsed) VALUES (?1, ?2, ?3)
         ON CONFLICT(board_id, card_id) DO UPDATE SET collapsed = excluded.collapsed",
        params![board_id, card_id, value as i64],
    )?;
    Ok(())
}

// === boards =================================================================

pub fn set_active(conn: &Connection, id: Option<&str>) -> rusqlite::Result<()> {
    set_meta(conn, "active_board_id", id)
}

pub fn add_board(conn: &mut Connection, id: &str, name: &str, color: &str) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let next_ord: i64 = tx.query_row("SELECT COALESCE(MAX(ord) + 1, 0) FROM boards", [], |r| {
        r.get(0)
    })?;
    tx.execute(
        "INSERT INTO boards (id, name, color, group_by, filter_connector, filter_open, ord)
         VALUES (?1, ?2, ?3, NULL, 'AND', 0, ?4)",
        params![id, name, color, next_ord],
    )?;
    tx.execute(
        "INSERT INTO app_meta (key, value) VALUES ('active_board_id', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![id],
    )?;
    tx.commit()
}

/// Persist a new board order: `order` is the list of board ids top-to-bottom.
/// Each board's `ord` is set to its index, matching the `ORDER BY ord` load query.
pub fn reorder_boards(conn: &mut Connection, order: &[String]) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    for (i, id) in order.iter().enumerate() {
        tx.execute("UPDATE boards SET ord = ?2 WHERE id = ?1", params![id, i as i64])?;
    }
    tx.commit()
}

pub fn remove_board(conn: &mut Connection, id: &str) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let prev_active: Option<String> = tx
        .query_row(
            "SELECT value FROM app_meta WHERE key='active_board_id'",
            [],
            |r| r.get(0),
        )
        .optional()?
        .flatten();
    tx.execute("DELETE FROM boards WHERE id = ?1", params![id])?;
    if prev_active.as_deref() == Some(id) {
        let next: Option<String> = tx
            .query_row(
                "SELECT id FROM boards ORDER BY ord, rowid LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        tx.execute(
            "INSERT INTO app_meta (key, value) VALUES ('active_board_id', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![next],
        )?;
    }
    tx.commit()
}

pub fn update_board(conn: &mut Connection, id: &str, patch: &Value) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    if let Some(name) = pstr(patch, "name") {
        tx.execute(
            "UPDATE boards SET name = ?2 WHERE id = ?1",
            params![id, name],
        )?;
    }
    if let Some(color) = pstr(patch, "color") {
        tx.execute(
            "UPDATE boards SET color = ?2 WHERE id = ?1",
            params![id, color],
        )?;
    }
    if patch.get("groupBy").is_some() {
        let group_by = patch.get("groupBy").and_then(Value::as_str);
        tx.execute(
            "UPDATE boards SET group_by = ?2 WHERE id = ?1",
            params![id, group_by],
        )?;
    }
    if let Some(open) = patch.get("filterOpen").and_then(Value::as_bool) {
        tx.execute(
            "UPDATE boards SET filter_open = ?2 WHERE id = ?1",
            params![id, open as i64],
        )?;
    }
    if let Some(filter) = patch.get("filter") {
        if let Some(conn_str) = filter.get("connector").and_then(Value::as_str) {
            tx.execute(
                "UPDATE boards SET filter_connector = ?2 WHERE id = ?1",
                params![id, conn_str],
            )?;
        }
        if let Some(enabled) = filter.get("enabled").and_then(Value::as_bool) {
            tx.execute(
                "UPDATE boards SET filter_enabled = ?2 WHERE id = ?1",
                params![id, enabled as i64],
            )?;
        }
        tx.execute(
            "DELETE FROM board_filter_rules WHERE board_id = ?1",
            params![id],
        )?;
        if let Some(rules) = filter.get("rules").and_then(Value::as_array) {
            for (i, rule) in rules.iter().enumerate() {
                let rid = rule.get("id").and_then(Value::as_str).unwrap_or("");
                let prop = rule.get("prop").and_then(Value::as_str).unwrap_or("");
                let op = rule.get("op").and_then(Value::as_str).unwrap_or("is");
                let (value, value2): (Option<String>, Option<String>) = match rule.get("value") {
                    Some(Value::Array(arr)) => (
                        arr.first().and_then(Value::as_str).map(str::to_string),
                        arr.get(1).and_then(Value::as_str).map(str::to_string),
                    ),
                    Some(Value::String(s)) => (Some(s.clone()), None),
                    _ => (None, None),
                };
                tx.execute(
                    "INSERT INTO board_filter_rules (id, board_id, prop, op, value, value2, ord)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![rid, id, prop, op, value, value2, i as i64],
                )?;
            }
        }
    }
    tx.commit()
}

/// Compute the next dense `ord` (append position) for a `(board, property)` list.
fn next_column_ord(conn: &Connection, board_id: &str, property: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(MAX(ord) + 1, 0) FROM board_columns WHERE board_id = ?1 AND property = ?2",
        params![board_id, property],
        |r| r.get(0),
    )
}

pub fn set_column_config(
    conn: &Connection,
    board_id: &str,
    property: &str,
    value: &str,
    patch: &Value,
) -> rusqlite::Result<()> {
    // ensure a row exists (append at end if brand new); color/hidden patched below
    let ord = next_column_ord(conn, board_id, property)?;
    conn.execute(
        "INSERT INTO board_columns (board_id, property, value, ord) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(board_id, property, value) DO NOTHING",
        params![board_id, property, value, ord],
    )?;
    if let Some(color) = pstr(patch, "color") {
        conn.execute(
            "UPDATE board_columns SET color = ?4 WHERE board_id = ?1 AND property = ?2 AND value = ?3",
            params![board_id, property, value, color],
        )?;
    }
    if let Some(hidden) = patch.get("hidden").and_then(Value::as_bool) {
        conn.execute(
            "UPDATE board_columns SET hidden = ?4 WHERE board_id = ?1 AND property = ?2 AND value = ?3",
            params![board_id, property, value, hidden as i64],
        )?;
    }
    Ok(())
}

pub fn add_column(
    conn: &Connection,
    board_id: &str,
    property: &str,
    value: &str,
    color: &str,
    order: i64,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO board_columns (board_id, property, value, color, ord, hidden) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
        params![board_id, property, value, color, order],
    )?;
    Ok(())
}

pub fn reorder_column(
    conn: &mut Connection,
    board_id: &str,
    property: &str,
    value: &str,
    dir: &str,
) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let mut cols: Vec<String> = {
        let mut stmt = tx.prepare(
            "SELECT value FROM board_columns WHERE board_id = ?1 AND property = ?2 ORDER BY ord, rowid",
        )?;
        let rows = stmt.query_map(params![board_id, property], |r| r.get::<_, String>(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };
    if let Some(i) = cols.iter().position(|v| v == value) {
        let j = if dir == "left" {
            i.checked_sub(1)
        } else {
            Some(i + 1)
        };
        if let Some(j) = j {
            if j < cols.len() {
                cols.swap(i, j);
                for (idx, v) in cols.iter().enumerate() {
                    tx.execute(
                        "UPDATE board_columns SET ord = ?4 WHERE board_id = ?1 AND property = ?2 AND value = ?3",
                        params![board_id, property, v, idx as i64],
                    )?;
                }
            }
        }
    }
    tx.commit()
}

/// Set a property's left-to-right column order from a full ordered list of
/// values, assigning sequential `ord` indices in one transaction. Upserts a row
/// for any value not yet stored. Mirrors the `reorderColumns` reducer.
pub fn reorder_columns(
    conn: &mut Connection,
    board_id: &str,
    property: &str,
    order: &[String],
) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    for (idx, value) in order.iter().enumerate() {
        tx.execute(
            "INSERT INTO board_columns (board_id, property, value, ord) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(board_id, property, value) DO UPDATE SET ord = ?4",
            params![board_id, property, value, idx as i64],
        )?;
    }
    tx.commit()
}

/// Rename a grouping value across ALL cards (values are global) and every board's
/// column list for that property — in place, so positions never move (`ord`
/// untouched). Mirrors the reducer. Collision guard: if `to` already exists for
/// this property (as a card value or a stored column), the rename is a no-op, so
/// two columns can never be silently merged (spec §3.8).
pub fn rename_column(
    conn: &mut Connection,
    prop: &str,
    from: &str,
    to: &str,
) -> rusqlite::Result<()> {
    if to.is_empty() || from == to {
        return Ok(());
    }
    let in_cards: i64 = conn.query_row(
        "SELECT COUNT(*) FROM card_props WHERE name = ?1 AND value = ?2",
        params![prop, to],
        |r| r.get(0),
    )?;
    let in_cols: i64 = conn.query_row(
        "SELECT COUNT(*) FROM board_columns WHERE property = ?1 AND value = ?2",
        params![prop, to],
        |r| r.get(0),
    )?;
    if in_cards > 0 || in_cols > 0 {
        return Ok(()); // collision: reject as a no-op
    }
    let tx = conn.transaction()?;
    tx.execute(
        "UPDATE card_props SET value = ?3 WHERE name = ?1 AND value = ?2",
        params![prop, from, to],
    )?;
    tx.execute(
        "UPDATE board_columns SET value = ?3 WHERE property = ?1 AND value = ?2",
        params![prop, from, to],
    )?;
    tx.commit()
}

/// Remove a column from a board's list for a property. Touches the listing only —
/// never card data (cards keep their property value). Spec §3.7.
pub fn remove_column(
    conn: &Connection,
    board_id: &str,
    property: &str,
    value: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM board_columns WHERE board_id = ?1 AND property = ?2 AND value = ?3",
        params![board_id, property, value],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{ensure_seeded, load_snapshot, migrate};

    fn seeded() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&conn).unwrap();
        ensure_seeded(&mut conn).unwrap();
        conn
    }

    fn first_card_id(conn: &Connection) -> String {
        load_snapshot(conn)
            .unwrap()
            .cards
            .keys()
            .next()
            .unwrap()
            .clone()
    }

    #[test]
    fn set_prop_upsert_updates_in_place_and_appends() {
        let conn = seeded();
        let id = first_card_id(&conn);
        // update existing prop -> value changes, position preserved (still first)
        set_prop(&conn, &id, "Status", "Done", "select").unwrap();
        // add a brand-new prop -> appended at the end
        set_prop(&conn, &id, "Zeta", "hi", "text").unwrap();
        let snap = load_snapshot(&conn).unwrap();
        let card = &snap.cards[&id];
        assert_eq!(card.props["Status"].value, "Done");
        let names: Vec<&str> = card.props.keys().map(String::as_str).collect();
        assert_eq!(names.first(), Some(&"Status"));
        assert_eq!(names.last(), Some(&"Zeta"));
    }

    #[test]
    fn move_to_column_inherits_existing_type() {
        let mut conn = seeded();
        let board_id = load_snapshot(&conn).unwrap().boards[0].id.clone(); // grouped by Status
        let id = first_card_id(&conn);
        move_to_column(&conn, &id, &board_id, "Done").unwrap();
        let snap = load_snapshot(&conn).unwrap();
        let p = &snap.cards[&id].props["Status"];
        assert_eq!(p.value, "Done");
        assert_eq!(p.ptype, "select");
        let _ = &mut conn;
    }

    // Helper: the ordered value list of board 0's `Status` column list.
    fn status_values(conn: &Connection) -> Vec<String> {
        load_snapshot(conn).unwrap().boards[0].columns_by_property["Status"]
            .iter()
            .map(|c| c.value.clone())
            .collect()
    }

    #[test]
    fn reorder_boards_persists_new_order() {
        let mut conn = seeded();
        let ids: Vec<String> = load_snapshot(&conn).unwrap().boards.iter().map(|b| b.id.clone()).collect();
        assert!(ids.len() >= 3, "seed has 3 boards");
        // reverse the order
        let reversed: Vec<String> = ids.iter().rev().cloned().collect();
        reorder_boards(&mut conn, &reversed).unwrap();
        let after: Vec<String> = load_snapshot(&conn).unwrap().boards.iter().map(|b| b.id.clone()).collect();
        assert_eq!(after, reversed, "load_snapshot reflects the new ord");
    }

    #[test]
    fn reorder_columns_assigns_sequential_order_from_the_list() {
        let mut conn = seeded();
        let board_id = load_snapshot(&conn).unwrap().boards[0].id.clone(); // grouped by Status
        let order = vec![
            "Done".to_string(),
            "Backlog".to_string(),
            "In progress".to_string(),
            "Blocked".to_string(),
            "Archived".to_string(),
        ];
        reorder_columns(&mut conn, &board_id, "Status", &order).unwrap();
        assert_eq!(status_values(&conn), order);
    }

    #[test]
    fn reorder_columns_upserts_a_previously_unstored_value() {
        let mut conn = seeded();
        let board_id = load_snapshot(&conn).unwrap().boards[0].id.clone();
        let order = vec!["Icebox".to_string(), "Backlog".to_string()];
        reorder_columns(&mut conn, &board_id, "Status", &order).unwrap();
        let vals = status_values(&conn);
        assert_eq!(vals[0], "Icebox");
        assert_eq!(vals[1], "Backlog");
    }

    #[test]
    fn rename_column_rewrites_cards_and_keeps_position() {
        let mut conn = seeded();
        // "Backlog" -> "Zzz": alphabetically would jump to the end; must NOT move.
        rename_column(&mut conn, "Status", "Backlog", "Zzz").unwrap();
        let snap = load_snapshot(&conn).unwrap();
        let any_backlog = snap.cards.values().any(|c| {
            c.props.get("Status").map(|p| p.value == "Backlog").unwrap_or(false)
        });
        assert!(!any_backlog);
        assert!(snap.cards.values().any(|c| {
            c.props.get("Status").map(|p| p.value == "Zzz").unwrap_or(false)
        }));
        // position 0 preserved (no order argument needed anymore)
        assert_eq!(
            status_values(&conn),
            vec!["Zzz", "In progress", "Blocked", "Done", "Archived"]
        );
    }

    #[test]
    fn rename_column_collision_is_a_noop() {
        let mut conn = seeded();
        let before = status_values(&conn);
        // "Backlog" -> "Done" where "Done" already exists: rejected, nothing changes.
        rename_column(&mut conn, "Status", "Backlog", "Done").unwrap();
        assert_eq!(status_values(&conn), before);
        // a card still has Backlog (no rewrite happened)
        let snap = load_snapshot(&conn).unwrap();
        assert!(snap.cards.values().any(|c| {
            c.props.get("Status").map(|p| p.value == "Backlog").unwrap_or(false)
        }));
    }

    #[test]
    fn remove_column_drops_listing_only_not_card_data() {
        let mut conn = seeded();
        let board_id = load_snapshot(&conn).unwrap().boards[0].id.clone();
        // remove the empty "Archived" column
        remove_column(&conn, &board_id, "Status", "Archived").unwrap();
        assert!(!status_values(&conn).contains(&"Archived".to_string()));
        // removing a populated column drops the listing but keeps card values
        remove_column(&conn, &board_id, "Status", "Done").unwrap();
        let snap = load_snapshot(&conn).unwrap();
        assert!(!snap.boards[0].columns_by_property["Status"]
            .iter()
            .any(|c| c.value == "Done"));
        assert!(snap.cards.values().any(|c| {
            c.props.get("Status").map(|p| p.value == "Done").unwrap_or(false)
        }));
        let _ = &mut conn;
    }

    #[test]
    fn empty_column_persists() {
        let conn = seeded();
        // "Archived" has no cards but must survive a load round-trip.
        assert!(status_values(&conn).contains(&"Archived".to_string()));
    }

    #[test]
    fn toggle_promote_removes_when_both_false() {
        let conn = seeded();
        let id = first_card_id(&conn);
        toggle_promote(&conn, &id, "Status", true, false).unwrap();
        assert!(load_snapshot(&conn).unwrap().cards[&id]
            .promotions
            .contains_key("Status"));
        toggle_promote(&conn, &id, "Status", false, false).unwrap();
        assert!(!load_snapshot(&conn).unwrap().cards[&id]
            .promotions
            .contains_key("Status"));
    }

    #[test]
    fn add_and_update_card_round_trip() {
        let mut conn = seeded();
        let card: Card = serde_json::from_value(serde_json::json!({
            "id": "c_test", "body": "Hello\nworld", "created": 9999,
            "props": { "Status": { "type": "select", "value": "Backlog" } },
            "promotions": {}
        }))
        .unwrap();
        add_card(&mut conn, &card).unwrap();
        update_card(
            &conn,
            "c_test",
            &serde_json::json!({ "body": "Renamed\nnotes here" }),
        )
        .unwrap();
        let snap = load_snapshot(&conn).unwrap();
        let c = &snap.cards["c_test"];
        assert_eq!(c.body, "Renamed\nnotes here");
        assert_eq!(c.props["Status"].value, "Backlog");
    }

    #[test]
    fn update_board_replaces_filter_rules() {
        let mut conn = seeded();
        let board_id = load_snapshot(&conn).unwrap().boards[0].id.clone();
        let patch = serde_json::json!({
            "filter": { "connector": "OR", "rules": [
                { "id": "r_a", "prop": "Priority", "op": "is", "value": "High" },
                { "id": "r_b", "prop": "Estimate", "op": "between", "value": ["1", "5"] }
            ] }
        });
        update_board(&mut conn, &board_id, &patch).unwrap();
        let snap = load_snapshot(&conn).unwrap();
        let b = snap.boards.iter().find(|b| b.id == board_id).unwrap();
        assert_eq!(b.filter.connector, "OR");
        assert_eq!(b.filter.rules.len(), 2);
        assert_eq!(b.filter.rules[1].op, "between");
        assert_eq!(b.filter.rules[1].value, serde_json::json!(["1", "5"]));
    }

    #[test]
    fn update_board_persists_filter_enabled_toggle() {
        let mut conn = seeded();
        let board_id = load_snapshot(&conn).unwrap().boards[0].id.clone();

        // Boards start enabled (migration default).
        let snap = load_snapshot(&conn).unwrap();
        assert!(snap.boards[0].filter.enabled);

        // Disabling keeps the rules but flips the flag, and it survives a reload.
        update_board(
            &mut conn,
            &board_id,
            &serde_json::json!({
                "filter": {
                    "connector": "AND",
                    "enabled": false,
                    "rules": [{ "id": "r_a", "prop": "Priority", "op": "is", "value": "High" }]
                }
            }),
        )
        .unwrap();
        let b = load_snapshot(&conn).unwrap().boards[0].clone();
        assert!(!b.filter.enabled, "disabled flag should persist");
        assert_eq!(b.filter.rules.len(), 1, "rules are kept while disabled");

        // Re-enabling flips it back.
        update_board(
            &mut conn,
            &board_id,
            &serde_json::json!({ "filter": { "connector": "AND", "enabled": true, "rules": [] } }),
        )
        .unwrap();
        assert!(load_snapshot(&conn).unwrap().boards[0].filter.enabled);
    }
}
